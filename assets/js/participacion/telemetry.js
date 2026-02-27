// ============================================
// PARTICIPACION: TELEMETRIA MINIMA FUNNEL
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.telemetry) return;

  var TRACKED_PREFIX = 'ta_funnel_tracked::';

  var EVENTS = Object.freeze({
    LECTURA_FIRST_CONTRIBUTION: 'lectura_first_contribution',
    LECTURA_SECOND_PROMPT_OPENED: 'lectura_second_prompt_opened',
    LECTURA_SECOND_PROMPT_CHOICE_ANONIMO: 'lectura_second_prompt_choice_anonimo',
    LECTURA_SECOND_PROMPT_CHOICE_COLABORADOR: 'lectura_second_prompt_choice_colaborador',
    LECTURA_SECOND_PROMPT_ABANDONED: 'lectura_second_prompt_abandoned'
  });

  function warn(message, extra) {
    if (typeof extra === 'undefined') {
      console.warn('[participacion.telemetry] ' + message);
      return;
    }
    console.warn('[participacion.telemetry] ' + message, extra);
  }

  function getSessionState() {
    if (!ns.session || typeof ns.session.getState !== 'function') return null;
    return ns.session.getState();
  }

  function getTrackedStorageKey(eventName) {
    var state = getSessionState();
    if (!state) return null;

    var sessionKey = state.browserSessionToken || state.sessionId || null;
    if (!sessionKey) return null;
    return TRACKED_PREFIX + sessionKey + '::' + eventName;
  }

  function isValidEventName(eventName) {
    return Object.keys(EVENTS).some(function (key) {
      return EVENTS[key] === eventName;
    });
  }

  function hasBeenTracked(eventName) {
    var storageKey = getTrackedStorageKey(eventName);
    if (!storageKey) return false;

    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch (_error) {
      return false;
    }
  }

  function markTracked(eventName) {
    var storageKey = getTrackedStorageKey(eventName);
    if (!storageKey) return;

    try {
      sessionStorage.setItem(storageKey, '1');
    } catch (_error) {
      // Ignore storage write errors to avoid breaking UX.
    }
  }

  function normalizeMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value;
  }

  async function track(eventName, options) {
    var normalizedEventName = String(eventName || '').trim().toLowerCase();
    if (!isValidEventName(normalizedEventName)) return false;
    if (hasBeenTracked(normalizedEventName)) return true;

    if (!ns.session || typeof ns.session.getPublicSessionData !== 'function') {
      return false;
    }

    if (!ns.apiV2 || typeof ns.apiV2.trackFunnelEvent !== 'function') {
      return false;
    }

    var sessionData = ns.session.getPublicSessionData();
    if (!sessionData || !sessionData.session_id) {
      return false;
    }

    var input = options || {};
    var payload = {
      session_id: sessionData.session_id,
      event_name: normalizedEventName,
      context: String(input.context || 'lectura').trim() || 'lectura',
      metadata: normalizeMetadata(input.metadata)
    };

    try {
      var result = await ns.apiV2.trackFunnelEvent(payload);
      if (result && result.error) {
        warn('No se pudo registrar evento', result.error);
        return false;
      }
      markTracked(normalizedEventName);
      return true;
    } catch (error) {
      warn('No se pudo registrar evento', error);
      return false;
    }
  }

  ns.telemetry = {
    EVENTS: EVENTS,
    track: track
  };
})();
