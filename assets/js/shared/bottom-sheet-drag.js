function resolveElement(target) {
  return typeof target === 'function' ? target() : target;
}

function defaultThreshold(sheet) {
  return sheet
    ? Math.min(180, Math.max(84, sheet.offsetHeight * 0.2))
    : 96;
}

function createBottomSheetDragController(options = {}) {
  const state = {
    active: false,
    pointerId: null,
    startY: 0,
    currentDelta: 0,
    captureEl: null,
    resetTimer: null,
    boundHandle: null
  };

  const dragClass = options.dragClass || 'is-dragging';
  const resetDelay = Number.isFinite(options.resetDelay) ? options.resetDelay : 220;
  const minOpacity = Number.isFinite(options.minOpacity) ? options.minOpacity : 0.62;
  const opacityDistance = Number.isFinite(options.opacityDistance) ? options.opacityDistance : 360;
  const backdropOpacityDistance = Number.isFinite(options.backdropOpacityDistance)
    ? options.backdropOpacityDistance
    : 220;

  function getSheet() {
    return resolveElement(options.sheet);
  }

  function getHandle() {
    return resolveElement(options.handle);
  }

  function getBackdrop() {
    return resolveElement(options.backdrop);
  }

  function isEnabled() {
    return typeof options.isEnabled === 'function' ? !!options.isEnabled() : true;
  }

  function getThreshold(sheet) {
    return typeof options.getThreshold === 'function'
      ? options.getThreshold(sheet)
      : defaultThreshold(sheet);
  }

  function resetWindowListeners() {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerEnd);
    window.removeEventListener('pointercancel', handlePointerEnd);
  }

  function reset() {
    const sheet = getSheet();
    const backdrop = getBackdrop();

    if (state.resetTimer) {
      clearTimeout(state.resetTimer);
      state.resetTimer = null;
    }

    resetWindowListeners();

    if (sheet) {
      sheet.style.transform = '';
      sheet.style.opacity = '';
      sheet.classList.remove(dragClass);
    }

    if (backdrop) {
      backdrop.style.opacity = '';
    }

    state.active = false;
    state.pointerId = null;
    state.startY = 0;
    state.currentDelta = 0;
    state.captureEl = null;
  }

  function start(event) {
    if (!isEnabled()) return;
    if (event.button !== undefined && event.button !== 0) return;

    const sheet = getSheet();
    if (!sheet) return;

    reset();

    state.active = true;
    state.pointerId = event.pointerId;
    state.startY = event.clientY;
    state.currentDelta = 0;
    state.captureEl = event.currentTarget instanceof Element ? event.currentTarget : null;

    sheet.classList.add(dragClass);

    if (state.captureEl?.setPointerCapture) {
      try {
        state.captureEl.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Best effort.
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    event.preventDefault();
  }

  function handlePointerMove(event) {
    if (!state.active || event.pointerId !== state.pointerId) return;

    const sheet = getSheet();
    if (!sheet) return;

    const delta = Math.max(0, event.clientY - state.startY);
    const backdrop = getBackdrop();
    state.currentDelta = delta;

    sheet.style.transform = `translateY(${delta}px)`;
    sheet.style.opacity = String(Math.max(minOpacity, 1 - (delta / opacityDistance)));

    if (backdrop) {
      backdrop.style.opacity = String(Math.max(0, 1 - (delta / backdropOpacityDistance)));
    }

    event.preventDefault();
  }

  function handlePointerEnd(event) {
    if (!state.active || event.pointerId !== state.pointerId) return;

    const sheet = getSheet();
    const backdrop = getBackdrop();
    const shouldClose = state.currentDelta >= getThreshold(sheet);

    if (state.captureEl?.releasePointerCapture) {
      try {
        state.captureEl.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Best effort.
      }
    }

    resetWindowListeners();

    if (shouldClose) {
      reset();
      if (typeof options.onClose === 'function') {
        options.onClose();
      }
      return;
    }

    if (sheet) {
      sheet.style.transform = 'translateY(0)';
      sheet.style.opacity = '1';
      sheet.classList.add(dragClass);
    }

    if (backdrop) {
      backdrop.style.opacity = '1';
    }

    state.resetTimer = window.setTimeout(() => {
      reset();
    }, resetDelay);
  }

  function bind() {
    const handle = getHandle();
    if (!handle || handle === state.boundHandle) return controller;

    if (state.boundHandle) {
      state.boundHandle.removeEventListener('pointerdown', start);
    }

    state.boundHandle = handle;
    state.boundHandle.addEventListener('pointerdown', start);
    return controller;
  }

  function destroy() {
    reset();

    if (state.boundHandle) {
      state.boundHandle.removeEventListener('pointerdown', start);
      state.boundHandle = null;
    }
  }

  const controller = {
    bind,
    reset,
    destroy
  };

  return controller;
}

export {
  createBottomSheetDragController
};
