// ============================================
// PARTICIPACION: SESSION MANAGER
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.session) return;

  var SESSION_STATE_KEY = 'ta_participacion_state_v4';
  var LEGACY_SESSION_KEY = 'fuenteovejuna_session';
  var TAB_ID_SESSION_KEY = 'ta_participacion_tab_id';
  var BUS_CHANNEL_NAME = 'ta_participacion_sync';
  var BUS_STORAGE_KEY = 'ta_participacion_sync_bus';
  var SYNC_REQUEST_TIMEOUT_MS = 300;
  var VALID_MODES = { unasked: true, anonimo: true, colaborador: true };

  var channel = null;
  var busBound = false;
  var pendingSync = null;
  var seenBusIds = [];

  var state = {
    initialized: false,
    initPromise: null,
    ensurePromise: null,
    tabId: null,
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
    disciplina: null,
    lecturaContributionCount: 0,
    updatedAt: 0
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

  function clampNonNegativeInt(value) {
    var parsed = Number.parseInt(String(value || '0'), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }

  function isModeDefinedInternal() {
    return state.modeChoice === 'anonimo' || state.modeChoice === 'colaborador';
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

  function resetStateCore() {
    state.sessionId = null;
    state.browserSessionToken = createUuid();
    state.modoParticipacion = 'anonimo';
    state.collaboratorId = null;
    state.collaboratorCreatedAt = null;
    state.createdAt = null;
    state.lastActivityAt = null;
    state.modeChoice = 'unasked';
    state.displayName = null;
    state.nivelEstudios = null;
    state.disciplina = null;
    state.lecturaContributionCount = 0;
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

  function getOrCreateTabId() {
    if (state.tabId) return state.tabId;

    var stored = null;
    try {
      stored = normalizeUuid(sessionStorage.getItem(TAB_ID_SESSION_KEY));
    } catch (_err) {
      stored = null;
    }

    if (!stored) {
      stored = createUuid();
      try {
        sessionStorage.setItem(TAB_ID_SESSION_KEY, stored);
      } catch (_err2) {
        // Ignore storage write errors.
      }
    }

    state.tabId = stored;
    return state.tabId;
  }

  function snapshotForStorage() {
    return {
      tabId: state.tabId,
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
      disciplina: state.disciplina,
      lecturaContributionCount: state.lecturaContributionCount,
      updatedAt: state.updatedAt
    };
  }

  function sanitizeSharedState(input) {
    var raw = input && typeof input === 'object' ? input : {};

    var sessionId = normalizeUuid(raw.sessionId);
    var browserSessionToken = normalizeUuid(raw.browserSessionToken);
    var modoParticipacion = raw.modoParticipacion === 'colaborador' ? 'colaborador' : 'anonimo';
    var modeChoice = VALID_MODES[raw.modeChoice] ? raw.modeChoice : (modoParticipacion === 'colaborador' ? 'colaborador' : 'unasked');
    var collaboratorId = normalizeUuid(raw.collaboratorId);
    var count = clampNonNegativeInt(raw.lecturaContributionCount);
    var updatedAt = Number(raw.updatedAt);

    return {
      tabId: normalizeUuid(raw.tabId) || null,
      sessionId: sessionId,
      browserSessionToken: browserSessionToken,
      modoParticipacion: modoParticipacion,
      collaboratorId: collaboratorId,
      collaboratorCreatedAt: raw.collaboratorCreatedAt || null,
      createdAt: raw.createdAt || null,
      lastActivityAt: raw.lastActivityAt || null,
      modeChoice: modeChoice,
      displayName: raw.displayName || null,
      nivelEstudios: raw.nivelEstudios || null,
      disciplina: raw.disciplina || null,
      lecturaContributionCount: count,
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now()
    };
  }

  function applySanitizedState(next) {
    state.sessionId = next.sessionId;
    state.browserSessionToken = next.browserSessionToken;
    state.modoParticipacion = next.modoParticipacion;
    state.collaboratorId = next.collaboratorId;
    state.collaboratorCreatedAt = next.collaboratorCreatedAt;
    state.createdAt = next.createdAt;
    state.lastActivityAt = next.lastActivityAt;
    state.modeChoice = next.modeChoice;
    state.displayName = next.displayName;
    state.nivelEstudios = next.nivelEstudios;
    state.disciplina = next.disciplina;
    state.lecturaContributionCount = next.lecturaContributionCount;
    state.updatedAt = next.updatedAt;

    if (state.modoParticipacion !== 'colaborador' && state.modeChoice !== 'colaborador') {
      clearCollaboratorProfile();
    }
  }

  function readStateFromSessionStorage() {
    try {
      var parsed = safeParseJson(sessionStorage.getItem(SESSION_STATE_KEY));
      if (!parsed || typeof parsed !== 'object') return false;
      var sanitized = sanitizeSharedState(parsed);
      if (!sanitized.browserSessionToken) {
        sanitized.browserSessionToken = createUuid();
      }
      applySanitizedState(sanitized);
      return true;
    } catch (err) {
      warn('No se pudo leer estado en sessionStorage', err);
      return false;
    }
  }

  function persistStateToSessionStorage() {
    try {
      sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify(snapshotForStorage()));
    } catch (err) {
      warn('No se pudo escribir estado en sessionStorage', err);
    }
  }

  function clearStateFromSessionStorage() {
    try {
      sessionStorage.removeItem(SESSION_STATE_KEY);
    } catch (err) {
      warn('No se pudo limpiar estado en sessionStorage', err);
    }
  }

  function getStateScore(input) {
    var s = input && typeof input === 'object' ? input : {};
    var score = 0;
    if (normalizeUuid(s.sessionId)) score += 100;
    if (VALID_MODES[s.modeChoice] && s.modeChoice !== 'unasked') score += 40;
    if (normalizeUuid(s.browserSessionToken)) score += 20;
    if (clampNonNegativeInt(s.lecturaContributionCount) > 0) score += 10;
    return score;
  }

  function rememberBusId(messageId) {
    if (!messageId) return;
    if (seenBusIds.indexOf(messageId) !== -1) return;
    seenBusIds.push(messageId);
    if (seenBusIds.length > 400) {
      seenBusIds = seenBusIds.slice(seenBusIds.length - 200);
    }
  }

  function hasSeenBusId(messageId) {
    if (!messageId) return false;
    return seenBusIds.indexOf(messageId) !== -1;
  }

  function hasShareableState() {
    return !!(
      state.sessionId ||
      state.browserSessionToken ||
      state.modeChoice !== 'unasked' ||
      state.lecturaContributionCount > 0
    );
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
      disciplina: state.disciplina,
      lecturaContributionCount: state.lecturaContributionCount
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
      window.dispatchEvent(new CustomEvent('participacion:state-changed', { detail: detail }));
    } catch (_err) {
      // Ignore.
    }
  }

  function emitBusMessage(type, payload, targetTabId) {
    var message = {
      id: createUuid(),
      fromTabId: getOrCreateTabId(),
      targetTabId: normalizeUuid(targetTabId) || null,
      type: String(type || '').trim(),
      payload: payload || null,
      ts: Date.now()
    };

    if (!message.type) return;

    if (channel) {
      try {
        channel.postMessage(message);
      } catch (err) {
        warn('No se pudo publicar por BroadcastChannel', err);
      }
    }

    try {
      localStorage.setItem(BUS_STORAGE_KEY, JSON.stringify(message));
      localStorage.removeItem(BUS_STORAGE_KEY);
    } catch (_err2) {
      // Ignore storage bus errors.
    }
  }

  function syncAfterLocalMutation(previousState, reason, options) {
    var input = options || {};
    state.initialized = true;
    persistStateToSessionStorage();
    syncLegacySessionStorage();
    dispatchStateChanged({ previousState: previousState, reason: reason });

    if (input.broadcast === false) return;
    var messageType = input.messageType || 'state-patch';
    emitBusMessage(messageType, {
      reason: reason,
      state: snapshotForStorage()
    });
  }

  function applyIncomingSharedState(payload, reason) {
    if (!payload || typeof payload !== 'object') return;

    var incomingState = payload.state && typeof payload.state === 'object'
      ? payload.state
      : payload;

    var sanitized = sanitizeSharedState(incomingState);
    if (!sanitized.browserSessionToken) return;

    var currentSnapshot = snapshotForStorage();
    var incomingScore = getStateScore(sanitized);
    var currentScore = getStateScore(currentSnapshot);
    var isBetter = incomingScore > currentScore;
    var isNewer = sanitized.updatedAt >= (state.updatedAt || 0);

    if (!isBetter && !isNewer) return;

    var previousState = getState();
    applySanitizedState(sanitized);
    syncAfterLocalMutation(previousState, reason || 'cross-tab-sync', {
      broadcast: false
    });
  }

  function handleStateResponse(payload) {
    if (!payload || typeof payload !== 'object') return;

    var candidate = payload.state && typeof payload.state === 'object'
      ? payload.state
      : payload;

    var sanitized = sanitizeSharedState(candidate);
    if (!sanitized.browserSessionToken) return;

    if (!pendingSync) {
      if (!state.sessionId && state.modeChoice === 'unasked') {
        applyIncomingSharedState({ state: sanitized }, 'init-sync');
      }
      return;
    }

    if (!pendingSync.best) {
      pendingSync.best = sanitized;
      return;
    }

    var incomingScore = getStateScore(sanitized);
    var bestScore = getStateScore(pendingSync.best);
    if (incomingScore > bestScore) {
      pendingSync.best = sanitized;
      return;
    }

    if (incomingScore === bestScore && sanitized.updatedAt > pendingSync.best.updatedAt) {
      pendingSync.best = sanitized;
    }
  }

  function handleBusMessage(message) {
    if (!message || typeof message !== 'object') return;

    var messageId = String(message.id || '').trim();
    if (!messageId || hasSeenBusId(messageId)) return;
    rememberBusId(messageId);

    var fromTabId = normalizeUuid(message.fromTabId);
    if (fromTabId && fromTabId === getOrCreateTabId()) return;

    var targetTabId = normalizeUuid(message.targetTabId);
    if (targetTabId && targetTabId !== getOrCreateTabId()) return;

    var type = String(message.type || '').trim();
    var payload = message.payload || null;

    if (type === 'state-request') {
      if (!hasShareableState()) return;
      emitBusMessage('state-response', {
        state: snapshotForStorage()
      }, fromTabId);
      return;
    }

    if (type === 'state-response') {
      handleStateResponse(payload);
      return;
    }

    if (type === 'state-patch') {
      applyIncomingSharedState(payload, 'cross-tab-sync');
      return;
    }

    if (type === 'session-reset') {
      applyIncomingSharedState(payload, 'reset');
    }
  }

  function handleStorageBusEvent(event) {
    if (!event || event.key !== BUS_STORAGE_KEY) return;
    if (!event.newValue) return;

    var message = safeParseJson(event.newValue);
    if (!message) return;
    handleBusMessage(message);
  }

  function bindBus() {
    if (busBound) return;
    busBound = true;

    if (typeof window.BroadcastChannel === 'function') {
      try {
        channel = new window.BroadcastChannel(BUS_CHANNEL_NAME);
        channel.onmessage = function (event) {
          if (!event || typeof event.data === 'undefined') return;
          handleBusMessage(event.data);
        };
      } catch (err) {
        channel = null;
        warn('BroadcastChannel no disponible; se usara fallback storage', err);
      }
    }

    window.addEventListener('storage', handleStorageBusEvent);
  }

  function requestStateFromPeers() {
    if (pendingSync) return pendingSync.promise;

    pendingSync = {
      best: null,
      promise: null
    };

    pendingSync.promise = new Promise(function (resolve) {
      emitBusMessage('state-request', {
        requestedAt: Date.now()
      });

      window.setTimeout(function () {
        var winner = pendingSync ? pendingSync.best : null;
        pendingSync = null;
        resolve(winner);
      }, SYNC_REQUEST_TIMEOUT_MS);
    });

    return pendingSync.promise;
  }

  function ensureBrowserSessionToken() {
    var token = normalizeUuid(state.browserSessionToken);
    if (token) {
      state.browserSessionToken = token;
      return token;
    }

    state.browserSessionToken = createUuid();
    return state.browserSessionToken;
  }

  function applySessionRow(row) {
    if (!row || typeof row !== 'object') return;

    state.sessionId = normalizeUuid(row.session_id) || state.sessionId;
    state.browserSessionToken = normalizeUuid(row.browser_session_token) || state.browserSessionToken;
    state.modoParticipacion = row.modo_participacion === 'colaborador' ? 'colaborador' : 'anonimo';
    state.collaboratorId = normalizeUuid(row.collaborator_id) || null;
    state.collaboratorCreatedAt = row.collaborator_created_at || state.collaboratorCreatedAt;
    state.createdAt = row.created_at || state.createdAt;
    state.lastActivityAt = row.last_activity_at || state.lastActivityAt;

    if (state.modoParticipacion !== 'colaborador') {
      clearCollaboratorProfile();
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
    if (state.initialized) return getState();
    if (state.initPromise) return state.initPromise;

    state.initPromise = (async function () {
      getOrCreateTabId();
      bindBus();

      var hadStoredState = readStateFromSessionStorage();
      if (!hadStoredState) {
        resetStateCore();
        state.updatedAt = Date.now();
      }

      var needsPeerSync = !hadStoredState || (
        !state.sessionId &&
        state.modeChoice === 'unasked' &&
        clampNonNegativeInt(state.lecturaContributionCount) === 0
      );

      if (needsPeerSync) {
        var candidate = await requestStateFromPeers();
        if (candidate) {
          applySanitizedState(candidate);
        }
      }

      ensureBrowserSessionToken();
      state.initialized = true;
      persistStateToSessionStorage();
      syncLegacySessionStorage();
      return getState();
    })().finally(function () {
      state.initPromise = null;
    });

    return state.initPromise;
  }

  async function ensureSessionForWrite() {
    await init();

    if (state.ensurePromise) {
      return state.ensurePromise;
    }

    var api = getApi();
    if (!api) {
      return { ok: false, error: { message: 'Sesion no disponible' } };
    }

    state.ensurePromise = (async function () {
      var token = ensureBrowserSessionToken();
      var previousState = getState();
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
      state.updatedAt = Date.now();
      var changed = (
        previousState.sessionId !== state.sessionId ||
        previousState.browserSessionToken !== state.browserSessionToken ||
        previousState.modoParticipacion !== state.modoParticipacion ||
        previousState.collaboratorId !== state.collaboratorId ||
        previousState.modeChoice !== state.modeChoice
      );

      if (changed) {
        syncAfterLocalMutation(previousState, 'write-bootstrap');
      } else {
        state.initialized = true;
        persistStateToSessionStorage();
        syncLegacySessionStorage();
      }

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
    if (!api || !state.sessionId) {
      return { ok: false, error: { message: 'Sesion no disponible' } };
    }

    var response = await api.setModeAnonimo(state.sessionId);
    if (response.error || !response.data || !response.data.session_id) {
      return { ok: false, error: response.error || { message: 'No se pudo fijar modo anonimo' } };
    }

    var previousState = getState();
    applySessionRow(response.data);
    state.modeChoice = 'anonimo';
    clearCollaboratorProfile();
    state.updatedAt = Date.now();

    syncAfterLocalMutation(previousState, 'mode-change');
    return { ok: true, session: getPublicSessionData() };
  }

  async function registerAndBind(email, displayName, profile) {
    await init();

    var ensured = await ensureSessionForWrite();
    if (!ensured.ok) {
      return { ok: false, reason: 'invalid_session', error: ensured.error || null };
    }

    var api = getApi();
    if (!api || !state.sessionId) {
      return { ok: false, reason: 'invalid_session' };
    }

    var inputProfile = profile || {};
    var consentAccepted = inputProfile.consent_rgpd === true;
    var consentVersion = String(inputProfile.consent_rgpd_version || '').trim();
    var consentAcceptedAt = inputProfile.consent_accepted_at || null;

    if (!consentAccepted || !consentVersion) {
      return {
        ok: false,
        reason: 'missing_consent',
        error: { message: 'Debes aceptar la política de privacidad para registrarte.' }
      };
    }

    var emailHash = await hashEmail(email);
    var response = await api.registerAndBindSession({
      sessionId: state.sessionId,
      emailHash: emailHash,
      displayName: displayName || null,
      nivelEstudios: inputProfile.nivel_estudios || null,
      disciplina: inputProfile.disciplina || null,
      consentRgpd: consentAccepted,
      consentRgpdVersion: consentVersion,
      consentAcceptedAt: consentAcceptedAt
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

    var previousState = getState();
    applySessionRow(response.data.session || null);
    state.modeChoice = 'colaborador';

    var collaborator = response.data.collaborator || {};
    state.collaboratorId = normalizeUuid(collaborator.collaborator_id) || state.collaboratorId;
    state.collaboratorCreatedAt = collaborator.created_at || state.collaboratorCreatedAt;
    state.displayName = collaborator.display_name || null;
    state.nivelEstudios = collaborator.nivel_estudios || null;
    state.disciplina = collaborator.disciplina || null;
    state.updatedAt = Date.now();

    syncAfterLocalMutation(previousState, 'mode-change');

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

    var previousState = getState();
    applySessionRow(response.data.session || null);
    state.modeChoice = 'colaborador';

    var collaborator = response.data.collaborator || {};
    state.collaboratorId = normalizeUuid(collaborator.collaborator_id) || state.collaboratorId;
    state.collaboratorCreatedAt = collaborator.created_at || state.collaboratorCreatedAt;
    state.displayName = collaborator.display_name || null;
    state.nivelEstudios = collaborator.nivel_estudios || null;
    state.disciplina = collaborator.disciplina || null;
    state.updatedAt = Date.now();

    syncAfterLocalMutation(previousState, 'mode-change');

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
    if (api && state.sessionId) {
      var detachResponse = await api.setModeAnonimo(state.sessionId);
      if (detachResponse.error) {
        warn('No se pudo desasociar colaborador en reset', detachResponse.error);
      }
    }

    var previousState = getState();
    resetStateCore();
    state.updatedAt = Date.now();
    clearStateFromSessionStorage();

    syncAfterLocalMutation(previousState, 'reset', {
      messageType: 'session-reset'
    });

    return { ok: true, session: getPublicSessionData() };
  }

  async function refreshFromServer(modeHint) {
    await init();

    var api = getApi();
    if (!api || !state.browserSessionToken || !state.sessionId) {
      return { ok: false, error: { message: 'Sesion no disponible para refresh' } };
    }

    var response = await api.bootstrapSession(state.browserSessionToken);
    if (response.error || !response.data) {
      return { ok: false, error: response.error || { message: 'No se pudo refrescar sesion' } };
    }

    var previousState = getState();
    applySessionRow(response.data);

    if (VALID_MODES[modeHint]) {
      state.modeChoice = modeHint;
    } else if (state.modoParticipacion === 'colaborador') {
      state.modeChoice = 'colaborador';
    } else if (!VALID_MODES[state.modeChoice]) {
      state.modeChoice = 'unasked';
    }
    state.updatedAt = Date.now();

    syncAfterLocalMutation(previousState, 'cross-tab-sync');
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

  function getLecturaContributionCount() {
    return clampNonNegativeInt(state.lecturaContributionCount);
  }

  function incrementLecturaContributionCount() {
    var previousState = getState();
    state.lecturaContributionCount = clampNonNegativeInt(state.lecturaContributionCount) + 1;
    state.updatedAt = Date.now();
    syncAfterLocalMutation(previousState, 'count-change');
    return state.lecturaContributionCount;
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
    getStats: getStats,
    getLecturaContributionCount: getLecturaContributionCount,
    incrementLecturaContributionCount: incrementLecturaContributionCount
  };
})();
