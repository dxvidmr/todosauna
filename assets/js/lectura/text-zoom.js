const DEFAULT_ZOOM_PERCENT = 100;
const MIN_ZOOM_PERCENT = 80;
const MAX_ZOOM_PERCENT = 150;
const ZOOM_STEP_PERCENT = 5;

function resolveElement(ref) {
  if (typeof ref === 'function') {
    return ref() || null;
  }
  return ref || null;
}

function clampPercent(percent, minPercent, maxPercent) {
  return Math.max(minPercent, Math.min(maxPercent, percent));
}

function createTextZoomController(options = {}) {
  const {
    target,
    increaseButton,
    decreaseButton,
    display,
    defaultPercent = DEFAULT_ZOOM_PERCENT,
    minPercent = MIN_ZOOM_PERCENT,
    maxPercent = MAX_ZOOM_PERCENT,
    stepPercent = ZOOM_STEP_PERCENT,
    onAfterApply,
    canIncrease
  } = options;

  let currentPercent = clampPercent(defaultPercent, minPercent, maxPercent);

  function updateDisplay() {
    const displayEl = resolveElement(display);
    if (displayEl) {
      displayEl.textContent = `${currentPercent}%`;
    }
  }

  function applyPercent(nextPercent) {
    currentPercent = clampPercent(nextPercent, minPercent, maxPercent);
    const targetEl = resolveElement(target);
    if (targetEl) {
      targetEl.style.setProperty('--tei-text-zoom-percent', String(currentPercent));
    }
    updateDisplay();

    if (typeof onAfterApply === 'function') {
      onAfterApply({
        percent: currentPercent,
        target: targetEl
      });
    }

    return currentPercent;
  }

  function setPercent(nextPercent) {
    const previousPercent = currentPercent;
    const percent = applyPercent(nextPercent);
    return {
      ok: true,
      previousPercent,
      percent
    };
  }

  function increase() {
    if (currentPercent >= maxPercent) {
      return {
        ok: false,
        reason: 'max',
        percent: currentPercent
      };
    }

    const previousPercent = currentPercent;
    const nextPercent = applyPercent(currentPercent + stepPercent);

    if (typeof canIncrease === 'function' && !canIncrease({
      previousPercent,
      nextPercent,
      target: resolveElement(target)
    })) {
      applyPercent(previousPercent);
      return {
        ok: false,
        reason: 'blocked',
        previousPercent,
        percent: currentPercent
      };
    }

    return {
      ok: true,
      previousPercent,
      percent: nextPercent
    };
  }

  function decrease() {
    if (currentPercent <= minPercent) {
      return {
        ok: false,
        reason: 'min',
        percent: currentPercent
      };
    }

    const previousPercent = currentPercent;
    const nextPercent = applyPercent(currentPercent - stepPercent);
    return {
      ok: true,
      previousPercent,
      percent: nextPercent
    };
  }

  const increaseButtonEl = resolveElement(increaseButton);
  if (increaseButtonEl) {
    increaseButtonEl.addEventListener('click', () => {
      increase();
    });
  }

  const decreaseButtonEl = resolveElement(decreaseButton);
  if (decreaseButtonEl) {
    decreaseButtonEl.addEventListener('click', () => {
      decrease();
    });
  }

  applyPercent(currentPercent);

  return {
    getPercent() {
      return currentPercent;
    },
    setPercent,
    increase,
    decrease,
    sync() {
      return applyPercent(currentPercent);
    }
  };
}

export {
  DEFAULT_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  MAX_ZOOM_PERCENT,
  ZOOM_STEP_PERCENT,
  createTextZoomController
};
