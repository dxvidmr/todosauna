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

  function incrementLecturaParticipationCount() {
    var current = readLecturaParticipationCount();
    writeLecturaParticipationCount(current + 1);
    return current + 1;
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

    await ns.modal.open({
      context: 'lectura-second-contribution',
      reason: 'second-contribution'
    });

    return !!(ns.session.isModeDefined && ns.session.isModeDefined());
  }

  ns.flow = {
    canSubmitLecturaWithoutPrompt: canSubmitLecturaWithoutPrompt,
    incrementLecturaParticipationCount: incrementLecturaParticipationCount,
    ensureModeForSecondLecturaContribution: ensureModeForSecondLecturaContribution,
    _readLecturaParticipationCount: readLecturaParticipationCount
  };
})();

