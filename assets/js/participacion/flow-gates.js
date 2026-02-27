// ============================================
// PARTICIPACION: FLOW GATES (FASE 5)
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.flow) return;

  var LECTURA_COUNT_PREFIX = 'ta_lectura_contrib_count::';

  function warn(message, extra) {
    if (typeof extra === 'undefined') {
      console.warn('[participacion] ' + message);
      return;
    }
    console.warn('[participacion] ' + message, extra);
  }

  function getSessionState() {
    if (!ns.session || typeof ns.session.getState !== 'function') return null;
    return ns.session.getState();
  }

  function getStorageSessionKey() {
    var state = getSessionState();
    if (!state) return null;
    return state.browserSessionToken || state.sessionId || null;
  }

  function getLecturaCountStorageKey() {
    var sessionKey = getStorageSessionKey();
    if (!sessionKey) return null;
    return LECTURA_COUNT_PREFIX + sessionKey;
  }

  function readLecturaParticipationCount() {
    var storageKey = getLecturaCountStorageKey();
    if (!storageKey) return 0;

    try {
      var raw = localStorage.getItem(storageKey);
      var parsed = Number.parseInt(raw || '0', 10);
      if (!Number.isFinite(parsed) || parsed < 0) return 0;
      return parsed;
    } catch (err) {
      warn('No se pudo leer contador de lectura', err);
      return 0;
    }
  }

  function writeLecturaParticipationCount(nextCount) {
    var storageKey = getLecturaCountStorageKey();
    if (!storageKey) return;

    var normalized = Number.parseInt(String(nextCount), 10);
    var safeCount = Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;

    try {
      localStorage.setItem(storageKey, String(safeCount));
    } catch (err) {
      warn('No se pudo guardar contador de lectura', err);
    }
  }

  function canSubmitLecturaWithoutPrompt() {
    if (!ns.session) return true;
    if (ns.session.isModeDefined && ns.session.isModeDefined()) return true;
    return readLecturaParticipationCount() < 1;
  }

  function trackTelemetry(eventName, metadata) {
    if (!ns.telemetry || typeof ns.telemetry.track !== 'function') return;
    void ns.telemetry.track(eventName, {
      context: 'lectura',
      metadata: metadata || {}
    });
  }

  function incrementLecturaParticipationCount(options) {
    var input = options || {};
    var source = String(input.source || 'lectura').trim().toLowerCase() || 'lectura';
    var current = readLecturaParticipationCount();
    var nextCount = current + 1;
    writeLecturaParticipationCount(nextCount);

    if (
      current === 0 &&
      source === 'lectura' &&
      ns.telemetry &&
      ns.telemetry.EVENTS &&
      ns.telemetry.EVENTS.LECTURA_FIRST_CONTRIBUTION
    ) {
      trackTelemetry(ns.telemetry.EVENTS.LECTURA_FIRST_CONTRIBUTION, {
        source: source
      });
    }

    return nextCount;
  }

  async function ensureModeForSecondLecturaContribution() {
    if (!ns.session) return false;

    await ns.session.init();

    if (ns.session.isModeDefined && ns.session.isModeDefined()) {
      return true;
    }

    if (canSubmitLecturaWithoutPrompt()) {
      return true;
    }

    if (!ns.modal || typeof ns.modal.open !== 'function') {
      return false;
    }

    if (
      ns.telemetry &&
      ns.telemetry.EVENTS &&
      ns.telemetry.EVENTS.LECTURA_SECOND_PROMPT_OPENED
    ) {
      trackTelemetry(ns.telemetry.EVENTS.LECTURA_SECOND_PROMPT_OPENED, {
        reason: 'second-contribution'
      });
    }

    await ns.modal.open({
      context: 'lectura-second-contribution',
      reason: 'second-contribution'
    });

    if (
      !(ns.session.isModeDefined && ns.session.isModeDefined()) &&
      ns.telemetry &&
      ns.telemetry.EVENTS &&
      ns.telemetry.EVENTS.LECTURA_SECOND_PROMPT_ABANDONED
    ) {
      trackTelemetry(ns.telemetry.EVENTS.LECTURA_SECOND_PROMPT_ABANDONED, {
        reason: 'second-contribution'
      });
    }

    return !!(ns.session.isModeDefined && ns.session.isModeDefined());
  }

  ns.flow = {
    canSubmitLecturaWithoutPrompt: canSubmitLecturaWithoutPrompt,
    incrementLecturaParticipationCount: incrementLecturaParticipationCount,
    ensureModeForSecondLecturaContribution: ensureModeForSecondLecturaContribution,
    _readLecturaParticipationCount: readLecturaParticipationCount
  };
})();
