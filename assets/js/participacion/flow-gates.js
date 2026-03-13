// ============================================
// PARTICIPACION: FLOW GATES (FASE 5)
// ============================================

(function () {
  if (typeof window === 'undefined') return;

  var ns = window.Participacion || (window.Participacion = {});
  if (ns.flow) return;

  function trackTelemetry(eventName, metadata) {
    if (!ns.telemetry || typeof ns.telemetry.track !== 'function') return;
    void ns.telemetry.track(eventName, {
      context: 'lectura',
      metadata: metadata || {}
    });
  }

  function getLecturaParticipationCount() {
    if (!ns.session || typeof ns.session.getLecturaContributionCount !== 'function') return 0;
    return Number(ns.session.getLecturaContributionCount() || 0);
  }

  function canSubmitLecturaWithoutPrompt() {
    if (!ns.session) return true;
    if (ns.session.isModeDefined && ns.session.isModeDefined()) return true;
    return getLecturaParticipationCount() < 1;
  }

  function incrementLecturaParticipationCount(options) {
    var input = options || {};
    var source = String(input.source || 'lectura').trim().toLowerCase() || 'lectura';
    var current = getLecturaParticipationCount();
    var nextCount = current + 1;

    if (ns.session && typeof ns.session.incrementLecturaContributionCount === 'function') {
      nextCount = Number(ns.session.incrementLecturaContributionCount() || nextCount);
    }

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
    _readLecturaParticipationCount: getLecturaParticipationCount
  };
})();
