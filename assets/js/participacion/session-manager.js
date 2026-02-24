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
  var VALID_MODES = { unasked: true, anonimo: true, colaborador: true };

  var state = {
    initialized: false,
    bootstrapPromise: null,
    sessionId: null,
    browserSessionToken: null,
    modoParticipacion: 'anonimo',
    collaboratorId: null,
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

  function primeStateFromStorage() {
    var tokenFromCookie = normalizeUuid(readCookie(COOKIE_NAME));
    if (!tokenFromCookie) return;

    state.browserSessionToken = tokenFromCookie;
    var storedMode = readModeChoice(tokenFromCookie);
    if (storedMode) {
      state.modeChoice = storedMode;
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

  function getState() {
    return {
      initialized: state.initialized,
      sessionId: state.sessionId,
      browserSessionToken: state.browserSessionToken,
      modoParticipacion: state.modoParticipacion,
      collaboratorId: state.collaboratorId,
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
      created_at: state.createdAt,
      last_activity_at: state.lastActivityAt
    };
  }

  function applySessionRow(row) {
    if (!row) return;

    state.sessionId = row.session_id || state.sessionId;
    state.browserSessionToken = row.browser_session_token || state.browserSessionToken;
    state.modoParticipacion = row.modo_participacion || state.modoParticipacion || 'anonimo';
    state.collaboratorId = row.collaborator_id || null;
    state.createdAt = row.created_at || state.createdAt;
    state.lastActivityAt = row.last_activity_at || state.lastActivityAt;
  }

  function dispatchStateChanged() {
    try {
      window.dispatchEvent(
        new CustomEvent('participacion:state-changed', { detail: getState() })
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
    if (state.initialized && state.sessionId) {
      return getState();
    }

    if (state.bootstrapPromise) {
      return state.bootstrapPromise;
    }

    state.bootstrapPromise = (async function () {
      var api = getApi();
      if (!api) {
        state.initialized = true;
        return getState();
      }

      var cookieToken = normalizeUuid(readCookie(COOKIE_NAME));
      var response = await api.bootstrapSession(cookieToken);

      if (response.error || !response.data || !response.data.session_id) {
        warn('No se pudo bootstrap de sesion', response.error);
        state.initialized = true;
        return getState();
      }

      applySessionRow(response.data);

      var normalizedToken = normalizeUuid(state.browserSessionToken);
      if (normalizedToken) {
        state.browserSessionToken = normalizedToken;
        writeSessionCookie(normalizedToken);
      }

      var storedMode = readModeChoice(state.browserSessionToken);
      if (!storedMode) {
        storedMode = state.modoParticipacion === 'colaborador' ? 'colaborador' : 'unasked';
      }

      state.modeChoice = storedMode;
      writeModeChoice(state.browserSessionToken, state.modeChoice);
      syncLegacySessionStorage();
      state.initialized = true;
      dispatchStateChanged();
      log('Sesion bootstrap lista', getPublicSessionData());
      return getState();
    })().finally(function () {
      state.bootstrapPromise = null;
    });

    return state.bootstrapPromise;
  }

  async function setAnonimo() {
    await init();
    var api = getApi();
    if (!api || !state.sessionId) {
      return { ok: false, error: { message: 'Sesion no disponible' } };
    }

    var response = await api.setModeAnonimo(state.sessionId);
    if (response.error || !response.data || !response.data.session_id) {
      return { ok: false, error: response.error || { message: 'No se pudo fijar modo anonimo' } };
    }

    applySessionRow(response.data);
    state.modeChoice = 'anonimo';
    state.displayName = null;
    state.nivelEstudios = null;
    state.disciplina = null;

    writeModeChoice(state.browserSessionToken, state.modeChoice);
    syncLegacySessionStorage();
    dispatchStateChanged();
    return { ok: true, session: getPublicSessionData() };
  }

  async function registerAndBind(email, displayName, profile) {
    await init();
    var api = getApi();
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
    state.displayName = collaborator.display_name || null;
    state.nivelEstudios = collaborator.nivel_estudios || null;
    state.disciplina = collaborator.disciplina || null;

    writeModeChoice(state.browserSessionToken, state.modeChoice);
    syncLegacySessionStorage();
    dispatchStateChanged();

    return {
      ok: true,
      session: getPublicSessionData(),
      collaborator: collaborator
    };
  }

  async function loginAndBind(email) {
    await init();
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

    applySessionRow(response.data.session || null);
    state.modeChoice = 'colaborador';

    var collaborator = response.data.collaborator || {};
    state.collaboratorId = collaborator.collaborator_id || state.collaboratorId;
    state.displayName = collaborator.display_name || null;
    state.nivelEstudios = collaborator.nivel_estudios || null;
    state.disciplina = collaborator.disciplina || null;

    writeModeChoice(state.browserSessionToken, state.modeChoice);
    syncLegacySessionStorage();
    dispatchStateChanged();

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
      var response = await api.setModeAnonimo(state.sessionId);
      if (!response.error && response.data) {
        applySessionRow(response.data);
      } else if (response.error) {
        warn('No se pudo desasociar colaborador en reset', response.error);
      }
    }

    state.modeChoice = 'unasked';
    state.modoParticipacion = 'anonimo';
    state.collaboratorId = null;
    state.displayName = null;
    state.nivelEstudios = null;
    state.disciplina = null;

    writeModeChoice(state.browserSessionToken, state.modeChoice);
    clearLegacySessionStorage();
    dispatchStateChanged();
    return { ok: true, session: getPublicSessionData() };
  }

  async function refreshFromServer(modeHint) {
    await init();
    var api = getApi();
    if (!api || !state.browserSessionToken) {
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
    dispatchStateChanged();
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
    if (!window.SupabaseAPI || typeof window.SupabaseAPI.getSessionStats !== 'function') return null;

    var result = await window.SupabaseAPI.getSessionStats(legacyData.session_id);
    if (result.error || !result.data) return null;

    return {
      total_evaluaciones: Number(result.data.total_evaluaciones || 0),
      votos_up: Number(result.data.votos_up || 0),
      votos_down: Number(result.data.votos_down || 0),
      comentarios: Number(result.data.comentarios || 0)
    };
  }

  ns.session = {
    init: init,
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

  primeStateFromStorage();
  void ns.session.init();
})();
