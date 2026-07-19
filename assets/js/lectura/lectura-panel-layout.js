import { createBottomSheetDragController } from '../shared/bottom-sheet-drag.js';

const DESKTOP_BREAKPOINT = 992;
const PANEL_MIN_WIDTH = 320;
const PANEL_DEFAULT_MAX_WIDTH = 800;

export function createLecturaPanelLayoutController({
  wrapper,
  textColumn,
  panel,
  panelWrapper,
  resizeHandle,
  mobileDragHandle,
  isOpen,
  onMobileClose
}) {
  const dynamicRecenterEnabled = wrapper?.dataset.lecturaDynamicRecenter === 'true';
  let preferredOpenWidth = null;
  let insetUpdateRaf = null;
  let mobileDragController = null;

  function getLayoutTokenPx(token, fallback) {
    if (!wrapper) return fallback;
    const value = getComputedStyle(wrapper).getPropertyValue(token).trim();
    const px = parseFloat(value);
    return Number.isFinite(px) ? px : fallback;
  }

  function getCurrentTextPaddingLeftPx() {
    if (!textColumn) return 0;
    const px = parseFloat(getComputedStyle(textColumn).paddingLeft);
    return Number.isFinite(px) ? px : 0;
  }

  function getBaseTextPaddingLeftPx() {
    if (!textColumn) return 0;
    const previousInlineLeft = textColumn.style.paddingLeft;
    textColumn.style.paddingLeft = '';
    const baseLeft = getCurrentTextPaddingLeftPx();
    textColumn.style.paddingLeft = previousInlineLeft;
    return baseLeft;
  }

  function getCollapsedRailWidth() {
    return getLayoutTokenPx('--lectura-rail-collapsed-width', 56);
  }

  function getStableOpenPanelFootprint() {
    const panelWidth = panel?.offsetWidth || getLayoutTokenPx('--lectura-panel-open-min-width', 360);
    return panelWidth + getCollapsedRailWidth() + getLayoutTokenPx('--lectura-panel-gap-open', 12);
  }

  function updateDesktopTextInset() {
    if (!textColumn) return;
    const panelIsOpen = !!panel?.classList.contains('open');
    wrapper?.classList.toggle('lectura-panel-open', panelIsOpen);

    if (window.innerWidth < DESKTOP_BREAKPOINT) {
      textColumn.style.paddingRight = '';
      textColumn.style.paddingLeft = '';
      return;
    }

    if (!dynamicRecenterEnabled) {
      textColumn.style.paddingLeft = '';
      const rightInset = panelIsOpen
        ? getStableOpenPanelFootprint()
        : getCollapsedRailWidth() + getLayoutTokenPx('--lectura-panel-gap-closed', 12);
      textColumn.style.paddingRight = `${Math.round(rightInset)}px`;
      return;
    }

    if (!panelIsOpen) {
      textColumn.style.paddingRight = '';
      textColumn.style.paddingLeft = '';
      return;
    }

    const staticRightInset = getLayoutTokenPx('--lectura-static-right-inset', 560);
    const panelFootprint = getStableOpenPanelFootprint()
      + getLayoutTokenPx('--lectura-panel-right-offset', 20)
      + getLayoutTokenPx('--lectura-open-right-safety', 16);
    const openRightInset = Math.max(staticRightInset, panelFootprint);
    const baseLeft = getBaseTextPaddingLeftPx();
    const openLeft = window.innerWidth >= 1600
      ? baseLeft
      : Math.max(
        getLayoutTokenPx('--lectura-text-left-min', 40),
        baseLeft - getLayoutTokenPx('--lectura-open-left-shift-base', 24)
      );

    textColumn.style.paddingRight = Math.abs(openRightInset - staticRightInset) >= 0.5
      ? `${Math.round(openRightInset)}px`
      : '';
    textColumn.style.paddingLeft = Math.abs(openLeft - baseLeft) >= 0.5
      ? `${Math.round(openLeft)}px`
      : '';
  }

  function requestInsetUpdate() {
    if (insetUpdateRaf) return;
    insetUpdateRaf = requestAnimationFrame(() => {
      insetUpdateRaf = null;
      updateDesktopTextInset();
    });
  }

  function getOpenMaxWidth() {
    return dynamicRecenterEnabled
      ? getLayoutTokenPx('--lectura-panel-open-width-safe-max', 420)
      : PANEL_DEFAULT_MAX_WIDTH;
  }

  function getInlineOpenWidth() {
    const width = parseFloat(panelWrapper?.style.getPropertyValue('--lectura-panel-open-width-inline'));
    return Number.isFinite(width) ? width : null;
  }

  function setOpenWidth(width, { remember = false } = {}) {
    if (!panelWrapper || !Number.isFinite(width)) return;
    const clampedWidth = Math.min(Math.max(width, PANEL_MIN_WIDTH), getOpenMaxWidth());
    panelWrapper.style.setProperty('--lectura-panel-open-width-inline', `${Math.round(clampedWidth)}px`);
    if (remember) preferredOpenWidth = clampedWidth;
  }

  function ensureOpenWidth() {
    if (!panelWrapper || window.innerWidth < DESKTOP_BREAKPOINT) return;
    if (Number.isFinite(preferredOpenWidth)) {
      setOpenWidth(preferredOpenWidth);
      return;
    }
    if (!Number.isFinite(getInlineOpenWidth())) {
      setOpenWidth(getLayoutTokenPx('--lectura-panel-open-min-width', 360));
    }
  }

  function bind() {
    mobileDragController = createBottomSheetDragController({
      sheet: () => panel,
      handle: () => mobileDragHandle,
      isEnabled: () => window.innerWidth < DESKTOP_BREAKPOINT && isOpen(),
      onClose: onMobileClose
    }).bind();

    if (resizeHandle && panelWrapper) {
      let isResizing = false;
      let startX = 0;
      let startWidth = 0;

      window.addEventListener('resize', () => {
        if (window.innerWidth < DESKTOP_BREAKPOINT) {
          panelWrapper.style.removeProperty('--lectura-panel-open-width-inline');
        } else if (isOpen()) {
          ensureOpenWidth();
        }
        requestInsetUpdate();
      });

      if (window.innerWidth >= DESKTOP_BREAKPOINT) {
        resizeHandle.addEventListener('mousedown', (event) => {
          if (window.innerWidth < DESKTOP_BREAKPOINT) return;
          isResizing = true;
          startX = event.clientX;
          startWidth = getInlineOpenWidth() || panel?.offsetWidth || panelWrapper.offsetWidth;
          document.body.style.cursor = 'ew-resize';
          document.body.style.userSelect = 'none';
          event.preventDefault();
        });
        document.addEventListener('mousemove', (event) => {
          if (!isResizing || window.innerWidth < DESKTOP_BREAKPOINT) return;
          const newWidth = Math.min(
            Math.max(startWidth + startX - event.clientX, PANEL_MIN_WIDTH),
            getOpenMaxWidth()
          );
          setOpenWidth(newWidth, { remember: true });
          if (!dynamicRecenterEnabled && textColumn) {
            textColumn.style.paddingRight = `${newWidth + 100}px`;
          }
          requestInsetUpdate();
        });
        document.addEventListener('mouseup', () => {
          if (!isResizing) return;
          isResizing = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          requestInsetUpdate();
        });
      }
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(requestInsetUpdate);
    }
    requestInsetUpdate();
  }

  return {
    bind,
    ensureOpenWidth,
    requestInsetUpdate,
    resetMobileDrag: () => mobileDragController?.reset()
  };
}

export { DESKTOP_BREAKPOINT as LECTURA_PANEL_DESKTOP_BREAKPOINT };
