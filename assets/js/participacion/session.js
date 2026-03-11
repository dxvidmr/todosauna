// ============================================
// PARTICIPACION: SESSION MANAGER
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.session) return;

  var COOKIE_NAME = 'ta_browser_session_token';
  var MODE_PREFIX = 'ta_mode_choice::';
  var LEGACY_SESSION_KEY = 'fuenteovejuna_session';
  var SHARED_STATE_KEY = 'ta_participacion_shared_state';
  var TAB_REGISTRY_KEY = 'ta_participacion_tabs_registry';
  var TAB_ID_SESSION_KEY = 'ta_participacion_tab_id';
  var LECTURA_COUNT_PREFIX = 'ta_lectura_contrib_count::';
  var VALID_MODES = { unasked: true, anonimo: true, colaborador: true };
  var TAB_HEARTBEAT_MS = 20000;
  var TAB_STALE_MS = 120000;

  var tabHeartbeatHandle = null;
  var lifecycleBound = false;
  var tabUnregistered = false;

  var state = {
    initialized: false,
    initPromise: null,
    ensurePromise: null,
    sessionId: null,
    browserSessionToken: null,
    modoParticipacion: 'anonimo',
    collaboratorId: null,
    collaboratorCreatedAt: null,
    createdAt: null,
    lastActivityAt: null,
    modeChoice: 'unasked',
    displayName: null,
    nivelEstudios: null,
    disciplina: null
  };

  function log(message, extra) {
    if (typeof extra === 'undefined') {
      console.log('[participacion] ' + message);
      return;
    }
    console.log('[participacion] ' + message, extra);
  }

  function warn(message, extra) {
    if (typeof extra === 'undefined') {
      console.warn('[participacion] ' + message);
      return;
    }
    console.warn('[participacion] ' + message, extra);
  }

  function normalizeUuid(value) {
    var raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;
    var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    return uuidRegex.test(raw) ? raw : null;
  }

  function createUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return template.replace(/[xy]/g, function (char) {
      var rnd = Math.random() * 16 | 0;
      var value = char === 'x' ? rnd : ((rnd & 0x3) | 0x8);
      return value.toString(16);
    });
  }

  function safeParseJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function readCookie(name) {
    var cookieString = document.cookie || '';
    if (!cookieString) return null;

    var target = name + '=';
    var parts = cookieString.split(';');
    for (var i = 0; i < parts.length; i += 1) {
      var segment = parts[i].trim();
      if (segment.indexOf(target) === 0) {
        return decodeURIComponent(segment.substring(target.length));
      }
    }
    return null;
  }

  function writeSessionCookie(token) {
    if (!token) return;
    document.cookie = COOKIE_NAME + '=' + encodeURIComponent(token) + '; path=/; SameSite=Lax';
  }

  function clearSessionCookie() {
    document.cookie = COOKIE_NAME + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }

  function getModeStorageKey(token) {
    return MODE_PREFIX + token;
  }

  function readModeChoice(token) {
    if (!token) return null;
    try {
      var stored = localStorage.getItem(getModeStorageKey(token));
      return VALID_MODES[stored] ? stored : null;
    } catch (err) {
      warn('No se pudo leer modo localStorage', err);
      return null;
    }
  }

  function writeModeChoice(token, mode) {
    if (!token || !VALID_MODES[mode]) return;
    try {
      localStorage.setItem(getModeStorageKey(token), mode);
    } catch (err) {
      warn('No se pudo escribir modo localStorage', err);
    }
  }

  function removeModeChoice(token) {
    if (!token) return;
    try {
      localStorage.removeItem(getModeStorageKey(token));
    } catch (err) {
      warn('No se pudo limpiar modo localStorage', err);
    }
  }

  function removeLecturaCount(token) {
    if (!token) return;
    try {
      localStorage.removeItem(LECTURA_COUNT_PREFIX + token);
    } catch (err) {
      warn('No se pudo limpiar contador local de lectura', err);
    }
  }

  function isModeDefinedInternal() {
    return state.modeChoice === 'anonimo' || state.modeChoice === 'colaborador';
  }

  function clearLegacySessionStorage() {
    try {
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch (err) {
      warn('No se pudo limpiar sessionStorage legacy', err);
    }
  }

  function syncLegacySessionStorage() {
    if (!state.sessionId || !isModeDefinedInternal()) {
      clearLegacySessionStorage();
      return;
    }

    var payload = {
      session_id: state.sessionId,
      modo_participacion: state.modeChoice,
      collaborator_id: state.collaboratorId,
      display_name: state.displayName,
      nivel_estudios: state.nivelEstudios,
      disciplina: state.disciplina
    };

    try {
      sessionStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      warn('No se pudo sincronizar sessionStorage legacy', err);
    }
  }

  function getApi() {
    if (!ns.apiV2) {
      warn('apiV2 no disponible');
      return null;
    }
    return ns.apiV2;
  }

  function clearCollaboratorProfile() {
    state.collaboratorId = null;
    state.collaboratorCreatedAt = null;
    state.displayName = null;
    state.nivelEstudios = null;
    state.disciplina = null;
  }

  function resetStateForNewSession() {
    state.sessionId = null;
    state.browserSessionToken = null;
    state.modoParticipacion = 'anonimo';
    state.createdAt = null;
    state.lastActivityAt = null;
    state.modeChoice = 'unasked';
    clearCollaboratorProfile();
  }

  function readSharedState() {
    try {
      var raw = localStorage.getItem(SHARED_STATE_KEY);
      return safeParseJson(raw);
    } catch (err) {
      warn('No se pudo leer estado compartido localStorage', err);
      return null;
    }
  }

  function applySharedStateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;

    state.sessionId = normalizeUuid(snapshot.session_id) || null;
    state.browserSessionToken = normalizeUuid(snapshot.browser_session_token) || null;
    state.modoParticipacion = snapshot.modo_participacion === 'colaborador' ? 'colaborador' : 'anonimo';
    state.collaboratorId = normalizeUuid(snapshot.collaborator_id) || null;
    state.collaboratorCreatedAt = snapshot.collaborator_created_at || null;
    state.createdAt = snapshot.created_at || null;
    state.lastActivityAt = snapshot.last_activity_at || null;
    state.modeChoice = VALID_MODES[snapshot.mode_choice] ? snapshot.mode_choice : state.modeChoice;
    state.displayName = snapshot.display_name || null;
    state.nivelEstudios = snapshot.nivel_estudios || null;
    state.disciplina = snapshot.disciplina || null;

    if (state.modoParticipacion !== 'colaborador' && state.modeChoice !== 'colaborador') {
      clearCollaboratorProfile();
    }
  }

  function persistSharedState() {
    var payload = {
      session_id: state.sessionId || null,
      browser_session_token: state.browserSessionToken || null,
      modo_participacion: state.modoParticipacion || 'anonimo',
      collaborator_id: state.collaboratorId || null,
      collaborator_created_at: state.collaboratorCreatedAt || null,
      created_at: state.createdAt || null,
      last_activity_at: state.lastActivityAt || null,
      mode_choice: VALID_MODES[state.modeChoice] ? state.modeChoice : 'unasked',
      display_name: state.displayName || null,
      nivel_estudios: state.nivelEstudios || null,
      disciplina: state.disciplina || null
    };

    try {
      localStorage.setItem(SHARED_STATE_KEY, JSON.stringify(payload));
    } catch (err) {
      warn('No se pudo escribir estado compartido localStorage', err);
    }
  }

  function clearSharedState() {
    try {
      localStorage.removeItem(SHARED_STATE_KEY);
    } catch (err) {
      warn('No se pudo limpiar estado compartido localStorage', err);
    }
  }

  function ensureBrowserToken() {
    var current = normalizeUuid(state.browserSessionToken);
    if (current) {
      state.browserSessionToken = current;
      return current;
    }

    var cookieToken = normalizeUuid(readCookie(COOKIE_NAME));
    if (cookieToken) {
      state.browserSessionToken = cookieToken;
      return cookieToken;
    }

    var next = createUuid();
    state.browserSessionToken = next;
    return next;
  }

  function primeStateFromStorage() {
    var snapshot = readSharedState();
    if (snapshot) {
      applySharedStateSnapshot(snapshot);
    }

    if (!state.browserSessionToken) {
      var tokenFromCookie = normalizeUuid(readCookie(COOKIE_NAME));
      if (tokenFromCookie) {
        state.browserSessionToken = tokenFromCookie;
      }
    }

    var token = ensureBrowserToken();
    var storedMode = readModeChoice(token);
    if (!VALID_MODES[state.modeChoice] && storedMode) {
      state.modeChoice = storedMode;
    } else if (!VALID_MODES[state.modeChoice]) {
      state.modeChoice = state.modoParticipacion === 'colaborador' ? 'colaborador' : 'unasked';
    }

    writeSessionCookie(token);
    writeModeChoice(token, state.modeChoice);
    syncLegacySessionStorage();
    persistSharedState();
  }

  function getState() {
    return {
      initialized: state.initialized,
      sessionId: state.sessionId,
      browserSessionToken: state.browserSessionToken,
      modoParticipacion: state.modoParticipacion,
      collaboratorId: state.collaboratorId,
      collaboratorCreatedAt: state.collaboratorCreatedAt,
      createdAt: state.createdAt,
      lastActivityAt: state.lastActivityAt,
      modeChoice: state.modeChoice,
      displayName: state.displayName,
      nivelEstudios: state.nivelEstudios,
      disciplina: state.disciplina
    };
  }

  function getPublicSessionData() {
    return {
      session_id: state.sessionId,
      browser_session_token: state.browserSessionToken,
      modo_participacion: state.modoParticipacion,
      collaborator_id: state.collaboratorId,
      collaborator_created_at: state.collaboratorCreatedAt,
      created_at: state.createdAt,
      last_activity_at: state.lastActivityAt
    };
  }

  function applySessionRow(row) {
    if (!row) return;

    state.sessionId = normalizeUuid(row.session_id) || state.sessionId;
    state.browserSessionToken = normalizeUuid(row.browser_session_token) || state.browserSessionToken;
    state.modoParticipacion = row.modo_participacion || state.modoParticipacion || 'anonimo';
    state.collaboratorId = normalizeUuid(row.collaborator_id) || null;
    state.collaboratorCreatedAt = row.collaborator_created_at || state.collaboratorCreatedAt;
    state.createdAt = row.created_at || state.createdAt;
    state.lastActivityAt = row.last_activity_at || state.lastActivityAt;

    if (state.modoParticipacion !== 'colaborador') {
      clearCollaboratorProfile();
    }
  }

  function dispatchStateChanged(options) {
    var input = options || {};
    var previousState = input.previousState || null;
    var currentState = getState();
    var detail = Object.assign({}, currentState, {
      previousState: previousState,
      reason: String(input.reason || 'state-updated'),
      sessionChanged: !!(
        previousState &&
        previousState.sessionId &&
        previousState.sessionId !== currentState.sessionId
      ),
      browserSessionChanged: !!(
        previousState &&
        previousState.browserSessionToken &&
        previousState.browserSessionToken !== currentState.browserSessionToken
      )
    });

    try {
      window.dispatchEvent(
        new CustomEvent('participacion:state-changed', { detail: detail })
      );
    } catch (err) {
      // No-op on browsers without CustomEvent support.
    }
  }

  async function hashEmail(email) {
    var normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;

    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto no disponible');
    }

    var data = new TextEncoder().encode(normalized);
    var hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  async function init() {
    if (state.initialized) {
      return getState();
    }

    if (state.initPromise) {
      return state.initPromise;
    }

    state.initPromise = (async function () {
      primeStateFromStorage();
      bindLifecycleEvents();
      registerCurrentTabPresence();
      startTabHeartbeat();
      state.initialized = true;
      return getState();
    })().finally(function () {
      state.initPromise = null;
    });

    return state.initPromise;
  }

  async function ensureSessionForWrite() {
    await init();

    if (state.sessionId) {
      return { ok: true, session: getPublicSessionData() };
    }

    if (state.ensurePromise) {
      return state.ensurePromise;
    }

    var api = getApi();
    if (!api) {
      return { ok: false, error: { message: 'Sesion no disponible' } };
    }

    var previousState = getState();
    state.ensurePromise = (async function () {
      var token = ensureBrowserToken();
      writeSessionCookie(token);

      var response = await api.bootstrapSession(token);
      if (response.error || !response.data || !response.data.session_id) {
        warn('No se pudo bootstrap de sesion en envio', response.error);
        return {
          ok: false,
          error: response.error || { message: 'No se pudo crear sesion de participacion' }
        };
      }

      applySessionRow(response.data);

      if (!VALID_MODES[state.modeChoice]) {
        state.modeChoice = state.modoParticipacion === 'colaborador' ? 'colaborador' : 'unasked';
      }

      writeModeChoice(state.browserSessionToken, state.modeChoice);
      syncLegacySessionStorage();
      persistSharedState();
      dispatchStateChanged({ previousState: previousState, reason: 'bootstrap-write' });
      log('Sesion lista para participacion', getPublicSessionData());
      return { ok: true, session: getPublicSessionData() };
    })().finally(function () {
      state.ensurePromise = null;
    });

    return state.ensurePromise;
  }

  async function setAnonimo() {
    await init();
    var ensured = await ensureSessionForWrite();
    if (!ensured.ok) {
      return { ok: false, error: ensured.error || { message: 'Sesion no disponible' } };
    }

    var api = getApi();
    var previousState = getState();
    if (!api || !state.sessionId) {
      return { ok: false, error: { message: 'Sesion no disponible' } };
    }

    var response = await api.setModeAnonimo(state.sessionId);
    if (response.error || !response.data || !response.data.session_id) {
      return { ok: false, error: response.error || { message: 'No se pudo fijar modo anonimo' } };
    }

    applySessionRow(response.data);
    state.modeChoice = 'anonimo';
    clearCollaboratorProfile();

    writeModeChoice(state.browserSessionToken, state.modeChoice);
    syncLegacySessionStorage();
    persistSharedState();
    dispatchStateChanged({ previousState: previousState, reason: 'set-anonimo' });
    return { ok: true, session: getPublicSessionData() };
  }

  async function registerAndBind(email, displayName, profile) {
    await init();
    var ensured = await ensureSessionForWrite();
    if (!ensured.ok) {
      return { ok: false, reason: 'invalid_session', error: ensured.error || null };
    }

    var api = getApi();
    var previousState = getState();
    if (!api || !state.sessionId) {
      return { ok: false, reason: 'invalid_session' };
    }

    var inputProfile = profile || {};
    var emailHash = await hashEmail(email);
    var response = await api.registerAndBindSession({
      sessionId: state.sessionId,
      emailHash: emailHash,
      displayName: displayName || null,
      nivelEstudios: inputProfile.nivel_estudios || null,
      disciplina: inputProfile.disciplina || null
    });

    if (response.error || !response.data) {
      return { ok: false, reason: 'rpc_error', error: response.error };
    }

    if (!response.data.ok) {
      return {
        ok: false,
        reason: response.data.reason || 'unknown',
        collaborator: response.data.collaborator || null
      };
    }

    applySessionRow(response.data.session || null);
    state.modeChoice = 'colaborador';

    var collaborator = response.data.collaborator || {};
    state.collaboratorId = collaborator.collaborator_id || state.collaboratorId;
    state.collaboratorCreatedAt = collaborator.created_at || state.collaboratorCreatedAt;
    state.displayName = collaborator.display_name || null;
    state.nivelEstudios = collaborator.nivel_estudios || null;
    state.disciplina = collaborator.disciplina || null;

    writeModeChoice(state.browserSessionToken, state.modeChoice);
    syncLegacySessionStorage();
    persistSharedState();
    dispatchStateChanged({ previousState: previousState, reason: 'register-and-bind' });

    return {
      ok: true,
      session: getPublicSessionData(),
      collaborator: collaborator
    };
  }

  async function loginAndBind(email) {
    await init();
    var ensured = await ensureSessionForWrite();
    if (!ensured.ok) {
      return { ok: false, found: false, reason: 'invalid_session', error: ensured.error || null };
    }

    var api = getApi();
    var previousState = getState();
    if (!api || !state.sessionId) {
      return { ok: false, found: false, reason: 'invalid_session' };
    }

    var emailHash = await hashEmail(email);
    var response = await api.loginAndBindSession({
      sessionId: state.sessionId,
      emailHash: emailHash
    });

    if (response.error || !response.data) {
      return { ok: false, found: false, reason: 'rpc_error', error: response.error };
    }

    if (!response.data.ok) {
      return {
        ok: false,
        found: false,
        reason: response.data.reason || 'unknown',
        error: response.error || null
      };
    }

    if (!response.data.found) {
      return { ok: true, found: false, collaborator: null };
    }

    applySessionRow(response.data.session || null);
    state.modeChoice = 'colaborador';

    var collaborator = response.data.collaborator || {};
    state.collaboratorId = collaborator.collaborator_id || state.collaboratorId;
    state.collaboratorCreatedAt = collaborator.created_at || state.collaboratorCreatedAt;
    state.displayName = collaborator.display_name || null;
    state.nivelEstudios = collaborator.nivel_estudios || null;
    state.disciplina = collaborator.disciplina || null;

    writeModeChoice(state.browserSessionToken, state.modeChoice);
    syncLegacySessionStorage();
    persistSharedState();
    dispatchStateChanged({ previousState: previousState, reason: 'login-and-bind' });

    return {
      ok: true,
      found: true,
      collaborator: collaborator,
      session: getPublicSessionData()
    };
  }

  async function resetToUnasked() {
    await init();
    var api = getApi();
    var previousState = getState();
    var previousToken = previousState.browserSessionToken;

    if (api && previousState.sessionId) {
      var detachResponse = await api.setModeAnonimo(previousState.sessionId);
      if (detachResponse.error) {
        warn('No se pudo desasociar colaborador en reset', detachResponse.error);
      }
    }

    clearSessionCookie();
    clearLegacySessionStorage();
    resetStateForNewSession();
    state.modeChoice = 'unasked';
    clearCollaboratorProfile();
    state.browserSessionToken = createUuid();
    writeSessionCookie(state.browserSessionToken);
    writeModeChoice(state.browserSessionToken, state.modeChoice);
    persistSharedState();
    clearLegacySessionStorage();

    if (previousToken) {
      removeModeChoice(previousToken);
      removeLecturaCount(previousToken);
    }

    dispatchStateChanged({ previousState: previousState, reason: 'session-reset' });
    return { ok: true, session: getPublicSessionData() };
  }

  async function refreshFromServer(modeHint) {
    await init();
    var api = getApi();
    var previousState = getState();
    if (!api || !state.browserSessionToken || !state.sessionId) {
      return { ok: false, error: { message: 'Sesion no disponible para refresh' } };
    }

    var response = await api.bootstrapSession(state.browserSessionToken);
    if (response.error || !response.data) {
      return { ok: false, error: response.error || { message: 'No se pudo refrescar sesion' } };
    }

    applySessionRow(response.data);

    if (VALID_MODES[modeHint]) {
      state.modeChoice = modeHint;
    } else if (state.modoParticipacion === 'colaborador') {
      state.modeChoice = 'colaborador';
    } else if (!VALID_MODES[state.modeChoice]) {
      state.modeChoice = 'unasked';
    }

    writeModeChoice(state.browserSessionToken, state.modeChoice);
    syncLegacySessionStorage();
    persistSharedState();
    dispatchStateChanged({ previousState: previousState, reason: 'refresh-from-server' });
    return { ok: true, state: getState() };
  }

  function getLegacyUserData() {
    if (!state.sessionId || !isModeDefinedInternal()) return null;
    return {
      session_id: state.sessionId,
      modo_participacion: state.modeChoice,
      collaborator_id: state.collaboratorId,
      display_name: state.displayName,
      nivel_estudios: state.nivelEstudios,
      disciplina: state.disciplina
    };
  }

  async function getStats() {
    var legacyData = getLegacyUserData();
    if (!legacyData || !legacyData.session_id) return null;
    var api = getApi();
    if (!api || typeof api.getSessionStats !== 'function') return null;

    var result = await api.getSessionStats(legacyData.session_id);
    if (result.error || !result.data) return null;

    return {
      total_contribuciones: Number(result.data.total_contribuciones || 0),
      total_evaluaciones: Number(result.data.total_evaluaciones || 0),
      votos_up: Number(result.data.votos_up || 0),
      votos_down: Number(result.data.votos_down || 0),
      comentarios: Number(result.data.comentarios || 0),
      total_sugerencias: Number(result.data.total_sugerencias || 0),
      total_testimonios: Number(result.data.total_testimonios || 0),
      total_contribuciones_archivo: Number(result.data.total_contribuciones_archivo || 0),
      total_envios: Number(result.data.total_envios || 0)
    };
  }

  ns.session = {
    init: init,
    ensureSessionForWrite: ensureSessionForWrite,
    getState: getState,
    getPublicSessionData: getPublicSessionData,
    isModeDefined: function () {
      return isModeDefinedInternal();
    },
    setAnonimo: setAnonimo,
    registerAndBind: registerAndBind,
    loginAndBind: loginAndBind,
    resetToUnasked: resetToUnasked,
    refreshFromServer: refreshFromServer,
    hashEmail: hashEmail,
    getLegacyUserData: getLegacyUserData,
    getStats: getStats
  };

  function readTabRegistryRaw() {
    try {
      return safeParseJson(localStorage.getItem(TAB_REGISTRY_KEY)) || {};
    } catch (_err) {
      return {};
    }
  }

  function normalizeTabRegistry(input, nowTs) {
    var source = input && typeof input === 'object' ? input : {};
    var now = Number.isFinite(nowTs) ? nowTs : Date.now();
    var normalized = {};

    Object.keys(source).forEach(function (tabId) {
      var raw = Number(source[tabId]);
      if (!Number.isFinite(raw)) return;
      if (now - raw > TAB_STALE_MS) return;
      normalized[tabId] = raw;
    });

    return normalized;
  }

  function writeTabRegistry(registry) {
    var payload = registry && typeof registry === 'object' ? registry : {};
    var keys = Object.keys(payload);
    try {
      if (!keys.length) {
        localStorage.removeItem(TAB_REGISTRY_KEY);
        return;
      }
      localStorage.setItem(TAB_REGISTRY_KEY, JSON.stringify(payload));
    } catch (err) {
      warn('No se pudo escribir registro de pestanas', err);
    }
  }

  function getOrCreateTabId() {
    var stored = null;
    try {
      stored = normalizeUuid(sessionStorage.getItem(TAB_ID_SESSION_KEY));
    } catch (_err) {
      stored = null;
    }

    if (stored) return stored;

    var next = createUuid();
    try {
      sessionStorage.setItem(TAB_ID_SESSION_KEY, next);
    } catch (_err) {
      // Ignore.
    }
    return next;
  }

  function registerCurrentTabPresence() {
    var tabId = getOrCreateTabId();
    var now = Date.now();
    var registry = normalizeTabRegistry(readTabRegistryRaw(), now);
    registry[tabId] = now;
    writeTabRegistry(registry);
    tabUnregistered = false;
  }

  function unregisterCurrentTabPresence() {
    if (tabUnregistered) return;
    tabUnregistered = true;

    var tabId = null;
    try {
      tabId = normalizeUuid(sessionStorage.getItem(TAB_ID_SESSION_KEY));
    } catch (_err) {
      tabId = null;
    }
    if (!tabId) return;

    var now = Date.now();
    var registry = normalizeTabRegistry(readTabRegistryRaw(), now);
    delete registry[tabId];
    var remaining = Object.keys(registry).length;
    writeTabRegistry(registry);

    if (remaining === 0) {
      var token = state.browserSessionToken || normalizeUuid(readCookie(COOKIE_NAME));
      if (token) {
        removeModeChoice(token);
        removeLecturaCount(token);
      }
      clearSharedState();
      clearSessionCookie();
      clearLegacySessionStorage();
    }
  }

  function startTabHeartbeat() {
    if (tabHeartbeatHandle) return;
    tabHeartbeatHandle = window.setInterval(function () {
      registerCurrentTabPresence();
    }, TAB_HEARTBEAT_MS);
  }

  function stopTabHeartbeat() {
    if (!tabHeartbeatHandle) return;
    window.clearInterval(tabHeartbeatHandle);
    tabHeartbeatHandle = null;
  }

  function handleSharedStateStorageEvent(event) {
    if (!event || event.key !== SHARED_STATE_KEY) return;

    var previousState = getState();
    if (!event.newValue) {
      resetStateForNewSession();
      state.modeChoice = 'unasked';
      state.initialized = true;
      syncLegacySessionStorage();
      dispatchStateChanged({ previousState: previousState, reason: 'storage-cleared' });
      return;
    }

    var snapshot = safeParseJson(event.newValue);
    if (!snapshot) return;

    applySharedStateSnapshot(snapshot);
    if (!VALID_MODES[state.modeChoice]) {
      var storedMode = readModeChoice(state.browserSessionToken);
      state.modeChoice = storedMode || (state.modoParticipacion === 'colaborador' ? 'colaborador' : 'unasked');
    }
    state.initialized = true;
    syncLegacySessionStorage();
    dispatchStateChanged({ previousState: previousState, reason: 'storage-sync' });
  }

  function bindLifecycleEvents() {
    if (lifecycleBound) return;
    lifecycleBound = true;

    window.addEventListener('storage', handleSharedStateStorageEvent);
    window.addEventListener('pagehide', function () {
      stopTabHeartbeat();
      unregisterCurrentTabPresence();
    });
    window.addEventListener('beforeunload', function () {
      stopTabHeartbeat();
      unregisterCurrentTabPresence();
    });
  }

  primeStateFromStorage();
  bindLifecycleEvents();
  registerCurrentTabPresence();
  startTabHeartbeat();
  state.initialized = true;
})();
