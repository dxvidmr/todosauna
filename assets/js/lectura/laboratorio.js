import {
  mostrarToast,
  cargarXMLCacheado,
  alignSplitVerses,
  aplicarNumeracionVersos
} from './utils.js';
import {
  DEFAULT_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  MAX_ZOOM_PERCENT,
  ZOOM_STEP_PERCENT,
  createTextZoomController
} from './text-zoom.js';
import { extraerFragmento, extraerXmlIdsDelFragmento } from './pasajes.js';
import {
  renderNotePanel,
  renderNotePlaceholder
} from '../shared/note-panel.js';
import { createBottomSheetDragController } from '../shared/bottom-sheet-drag.js';
import {
  applyNoteHighlights,
  highlightNoteInText,
  markCurrentNoteInText,
  buildNoteBadgesHTML,
  buildNoteDisplayHTML,
  hydrateCbRefsInContainer
} from './notas-dom.js';
import {
  buildNoteEvaluationKey,
  cargarNotasActivas,
  filtrarNotasPorXmlIds
} from '../participacion/notas.js';
import {
  obtenerEvaluacionesStats,
  mountNoteEvaluationDock
} from '../participacion/note-evaluation-runtime.js';
import {
  obtenerEstadisticasGlobales,
  renderizarEstadisticasGlobales
} from '../participacion/laboratorio-stats.js';
import {
  createLaboratorioSessionStorage,
  getLaboratorioLobbyUrl,
  getLaboratorioSessionUrl,
  getRequestedLaboratorioMode
} from './laboratorio-session.js';
import {
  setPassageModeAttributes,
  setPassageModeBadges,
  setPassageProgressVisibility,
  setPreviousPassageVisibility,
  syncPassageNavigationButtons,
  syncPassageProgress
} from './laboratorio-passage-controls.js';
import {
  syncLaboratorioNoteCounters,
  syncLaboratorioNoteNavigation,
  syncLaboratorioNoteProgress,
  syncLaboratorioNoteToggle
} from './laboratorio-note-controls.js';

const LAB_PASAJES_URL = new URL('../../data/pasajes/fuenteovejuna.json', import.meta.url).toString();

// ============================================
// EDITOR SOCIAL (JUEGO DE EVALUACION)
// ============================================

class EditorSocial {
  constructor() {
    this.pasajeActualIndex = 0;
    this.pasajes = [];
    this.xmlDoc = null;
    this.pasajeActual = null;
    
    // Estado de notas del pasaje actual
    this.notasPasaje = [];
    this.notaActualIndex = -1;
    this.notasEvaluadas = new Set();
    this.isNoteSheetOpen = false;
    
    // Modo de navegación: 'secuencial' | 'aleatorio'
    this.modoNavegacion = null;
    
    // Tracking de pasajes visitados en modo aleatorio (para no repetir en sesión)
    this.pasajesVisitados = new Set();
    
    // Referencias DOM
    this.layoutEls = [];
    this.isLobbyPage = false;
    this.isSessionPage = false;
    this.allowSessionNavigation = false;
    this.sessionExitModal = null;
    this.sessionExitPending = false;
    this.sessionStartedAt = null;
    this.sessionUpdatedAt = null;
    this.sessionStorage = createLaboratorioSessionStorage(window);
    this.sessionStats = {
      notasEvaluadas: 0
    };
    this.sessionEvaluatedByPassage = {};
    this.currentPassageHadAction = false;
    this.labNoteViewTracker = window.Participacion?.pilotTracking?.createNoteViewTracker
      ? window.Participacion.pilotTracking.createNoteViewTracker('laboratorio')
      : null;
    this.ui = {
      desktop: null,
      mobile: null
    };
    this.activeShell = null;
    this.pasajeContent = null;
    this.notaContent = null;
    this.bienvenidaContainer = null;
    this.wrapperEl = null;
    this.navWrapper = null;
    this.notesBackdrop = null;
    this.notasColumn = null;
    this.notasContainerEl = null;
    this.btnNotasSheetToggle = null;
    this.btnCerrarNotas = null;
    this.fragmentoActual = null;
    this.isSuggestionTooltipActive = false;
    // Zoom del pasaje (sesión actual)
    this.labFontSizePercent = DEFAULT_ZOOM_PERCENT;
    this.labFontMin = MIN_ZOOM_PERCENT;
    this.labFontMax = MAX_ZOOM_PERCENT;
    this.labFontStep = ZOOM_STEP_PERCENT;
    this.textZoomController = null;
    this.resizeAdjustTimer = null;
    this.participationStateListenerBound = false;
    this.mobileSheetDragController = null;
    this.handleParticipationStateChanged = this.handleParticipationStateChanged.bind(this);
  }

  notifyFeedback(message, type, duration) {
    var text = String(message || '').trim();
    if (!text) return;

    if (window.Participacion?.ui?.notify) {
      window.Participacion.ui.notify({
        message: text,
        type: type || 'info',
        duration: duration || 2500
      });
      return;
    }

    if (typeof mostrarToast === 'function') {
      mostrarToast(text, duration || 2500);
      return;
    }

    console.log(text);
  }

  async confirmFeedback(options) {
    if (window.Participacion?.ui?.['confirm']) {
      return window.Participacion.ui['confirm'](options || {});
    }
    return false;
  }

  getLobbyUrl() {
    return getLaboratorioLobbyUrl(window.location.href);
  }

  getSessionUrl(modo) {
    return getLaboratorioSessionUrl(window.location.href, modo);
  }

  getRequestedMode() {
    return getRequestedLaboratorioMode(window.location.search);
  }

  readStoredSession() {
    return this.sessionStorage.read();
  }

  persistSession() {
    if (!this.isSessionPage || !this.modoNavegacion) return;

    const now = Date.now();
    if (!this.sessionStartedAt) {
      this.sessionStartedAt = now;
    }
    this.sessionUpdatedAt = now;

    this.sessionStorage.write({
      modo: this.modoNavegacion,
      pasajeActualIndex: this.pasajeActualIndex,
      pasajesVisitados: Array.from(this.pasajesVisitados),
      stats: this.sessionStats,
      evaluatedByPassage: this.sessionEvaluatedByPassage,
      startedAt: this.sessionStartedAt,
      updatedAt: this.sessionUpdatedAt
    });
  }

  clearStoredSession() {
    this.sessionStorage.clear();
  }

  restoreSessionMetadata(storedSession) {
    const data = storedSession || {};
    this.sessionStartedAt = Number(data.startedAt || Date.now());
    this.sessionUpdatedAt = Number(data.updatedAt || this.sessionStartedAt);
    this.sessionStats = Object.assign({ notasEvaluadas: 0 }, data.stats || {});
    this.pasajesVisitados = new Set(
      Array.isArray(data.pasajesVisitados)
        ? data.pasajesVisitados.map(Number).filter(Number.isInteger)
        : []
    );
    this.sessionEvaluatedByPassage = {};
    if (data.evaluatedByPassage && typeof data.evaluatedByPassage === 'object') {
      Object.entries(data.evaluatedByPassage).forEach(([pasajeId, noteKeys]) => {
        if (!Array.isArray(noteKeys)) return;
        this.sessionEvaluatedByPassage[pasajeId] = noteKeys
          .filter(noteKey => typeof noteKey === 'string' && noteKey.length > 0);
      });
    }
  }

  navigateAllowingSessionExit(url) {
    this.allowSessionNavigation = true;
    window.location.href = url;
  }

  /**
   * Carga dinamica de CETEI.js si no esta disponible.
   */
  async asegurarCETEI() {
    if (typeof window.CETEI !== 'undefined') return true;

    if (window.__ceteiLoadingPromise) {
      await window.__ceteiLoadingPromise;
      return typeof window.CETEI !== 'undefined';
    }

    window.__ceteiLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Usar rutas de Jekyll si están disponibles, sino ruta relativa
      const jsPath = window.SITE_PATHS?.js || '../assets/js/lectura';
      script.src = jsPath + '/CETEI.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar CETEI.js'));
      document.head.appendChild(script);
    });

    try {
      await window.__ceteiLoadingPromise;
      return typeof window.CETEI !== 'undefined';
    } finally {
      window.__ceteiLoadingPromise = null;
    }
  }

  /**
   * Inicializar editor social
   */
  async init() {
    console.log('Inicializando Editor Social...');

    // Referencias DOM
    this.bienvenidaContainer = document.getElementById('laboratorio-bienvenida');
    this.wrapperEl = document.querySelector('.laboratorio-wrapper');
    this.navWrapper = document.querySelector('.nav-wrapper');
    this.initializeShellUI();
    this.isSessionPage = this.layoutEls.length > 0 || !!document.querySelector('[data-lab-session-page]');
    this.isLobbyPage = !!this.bienvenidaContainer && !this.isSessionPage;
    if (this.isSessionPage) {
      this.setupTextZoomController();
    }
    this.syncResponsiveState();

    // Cargar pasajes desde asset estático derivado del XML
    await this.cargarPasajes();
    await this.cargarEstadisticasGlobales();
    this.setupBienvenidaListeners();

    if (!this.isSessionPage) {
      this.mostrarPantallaBienvenida();
      console.log('Editor Social inicializado');
      return;
    }

    // Cargar XML de Fuenteovejuna (se cachea)
    const xmlPath = window.SITE_PATHS?.xml || '../assets/xml';
    this.xmlDoc = await cargarXMLCacheado(xmlPath + '/fuenteovejuna.xml');

    // Asegurar CETEI antes de renderizar
    const okCetei = await this.asegurarCETEI();
    if (!okCetei) {
      throw new Error('CETEI.js no esta cargado y no se pudo cargar dinamicamente.');
    }

    // Event listeners para controles del laboratorio
    this.setupEventListeners();
    this.bindParticipationStateListener();
    this.actualizarBotonNotasSheet();
    this.syncResponsiveState();
    await this.iniciarSesionActivaDesdeRuta();
    this.setupSessionExitGuards();

    console.log('Editor Social inicializado');
  }

  /**
   * Cargar estadísticas globales
   */
  async cargarEstadisticasGlobales() {
    const container = document.querySelector('.stats-globales');
    
    if (!container) {
      return;
    }

    try {
      const stats = await obtenerEstadisticasGlobales();
      renderizarEstadisticasGlobales(container, stats);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      container.innerHTML = `
        <div class="stats-header">
          <i class="fa-solid fa-chart-bar" aria-hidden="true"></i>
          <strong>Estadísticas globales</strong>
        </div>
        <p class="stats-error">No disponible</p>
      `;
    }
  }

  /**
   * Aplicar estado visual global del laboratorio.
   * view: 'welcome' | 'mode'
   */
  aplicarEstadoVista(view) {
    const isMode = view === 'mode';

    if (this.wrapperEl) {
      this.wrapperEl.setAttribute('data-laboratorio-view', view);
    }

    document.body.classList.toggle('laboratorio-mode-active', isMode);
    document.body.classList.toggle('laboratorio-welcome-active', !isMode);

    if (this.navWrapper) {
      this.navWrapper.setAttribute('data-navbar-variant', isMode ? 'compact' : 'default');
      this.navWrapper.classList.remove('visible');
    }

    if (window.NavbarBehavior?.closeMenu) {
      window.NavbarBehavior.closeMenu();
    }

    if (window.NavbarBehavior?.showNavbar) {
      window.NavbarBehavior.showNavbar();
    }
  }

  buildShellUI(shell) {
    const root = document.querySelector(`[data-lab-shell="${shell}"]`);
    if (!root) return null;

    return {
      shell,
      root,
      pasajeContainer: root.querySelector('[data-lab-pasaje-container]'),
      pasajeContent: root.querySelector('[data-lab-pasaje-content]'),
      noteColumn: root.querySelector('[data-lab-note-column]'),
      noteSheet: root.querySelector('[data-lab-note-sheet]'),
      noteContent: root.querySelector('[data-lab-note-content]'),
      notesBackdrop: root.querySelector('[data-lab-notes-backdrop]'),
      btnNotesToggle: root.querySelector('[data-lab-notes-toggle]'),
      btnNotesClose: root.querySelector('[data-lab-notes-close]'),
      btnPrevPassage: root.querySelector('[data-lab-prev-passage]'),
      btnNextPassage: root.querySelector('[data-lab-next-passage]'),
      btnPrevNote: root.querySelector('[data-lab-note-prev]'),
      btnNextNote: root.querySelector('[data-lab-note-next]'),
      noteDragHandle: root.querySelector('[data-lab-note-drag-handle]'),
      fontDisplay: root.querySelector('[data-lab-font-display]'),
      fontDecrease: root.querySelector('[data-lab-font-decrease]'),
      fontIncrease: root.querySelector('[data-lab-font-increase]'),
      noteFooter: root.querySelector('[data-lab-note-footer]'),
      controlsShell: root.querySelector('[data-lab-controls-shell]')
    };
  }

  initializeShellUI() {
    this.ui.desktop = this.buildShellUI('desktop');
    this.ui.mobile = this.buildShellUI('mobile');
    this.layoutEls = this.getAllUIs()
      .map(ui => ui.root)
      .filter(Boolean);
    this.activeShell = this.getActiveShell();
    this.refreshActiveUIRefs();
    this.mobileSheetDragController = createBottomSheetDragController({
      sheet: () => this.ui.mobile?.noteSheet,
      handle: () => this.ui.mobile?.noteDragHandle,
      backdrop: () => this.ui.mobile?.notesBackdrop,
      isEnabled: () => this.isNarrowLayout() && this.isNoteSheetOpen,
      onClose: () => {
        this.closeNoteSheet({ focusPasaje: true });
      }
    }).bind();
  }

  getAllUIs() {
    return Object.values(this.ui).filter(Boolean);
  }

  getShellUI(shell) {
    return this.ui[shell] || null;
  }

  getActiveShell() {
    return this.isNarrowLayout() ? 'mobile' : 'desktop';
  }

  getActiveUI() {
    return this.getShellUI(this.activeShell || this.getActiveShell());
  }

  refreshActiveUIRefs() {
    const ui = this.getActiveUI();
    this.pasajeContent = ui?.pasajeContent || null;
    this.notaContent = ui?.noteContent || null;
    this.notesBackdrop = ui?.notesBackdrop || null;
    this.notasColumn = ui?.noteColumn || null;
    this.notasContainerEl = ui?.noteSheet || null;
    this.btnNotasSheetToggle = this.ui.mobile?.btnNotesToggle || null;
    this.btnCerrarNotas = this.ui.mobile?.btnNotesClose || null;
    return ui;
  }

  setTextForAll(selector, value) {
    const text = String(value);
    this.getAllUIs().forEach((ui) => {
      ui.root.querySelectorAll(selector).forEach((el) => {
        el.textContent = text;
      });
    });
  }

  clearShellContent(ui) {
    if (!ui) return;
    if (ui.pasajeContent) {
      ui.pasajeContent.innerHTML = '<div class="loading">Cargando pasaje...</div>';
    }
    if (ui.noteContent) {
      renderNotePlaceholder(ui.noteContent, {
        bodyMessage: 'Haz clic en un texto subrayado o usa las flechas para ver las notas',
        dockState: 'idle'
      });
    }
  }

  clearInactiveShells() {
    const activeUI = this.getActiveUI();
    this.getAllUIs().forEach((ui) => {
      if (ui !== activeUI) {
        this.clearShellContent(ui);
      }
    });
  }

  async rerenderActiveShell() {
    if (!this.pasajeActual || !this.fragmentoActual) return;

    this.refreshActiveUIRefs();
    this.clearInactiveShells();
    await this.renderizarPasaje(this.fragmentoActual, this.pasajeActual);
    this.aplicarHighlights();

    if (this.notasPasaje.length === 0) {
      this.renderizarEstadoNotaPanel(
        'No hay notas en este pasaje',
        'Sin evaluaciones disponibles en este pasaje'
      );
    } else if (this.notaActualIndex >= 0) {
      const notaActual = this.notasPasaje[this.notaActualIndex];
      this.renderizarNotaActual(notaActual);
      this.marcarNotaActualEnTexto(notaActual.nota_id, { autoScroll: false });
    } else {
      this.renderizarEstadoNotaPanel('', '');
    }

    this.actualizarContadores();
    this.actualizarBarraProgreso();
    this.actualizarBarraProgresoNotas();
    this.actualizarBotonesNavegacion();
    this.actualizarBotonesNavegacionPasajes();
    this.actualizarBotonNotasSheet();
  }

  setSuggestionTooltipActive(isActive) {
    this.isSuggestionTooltipActive = !!isActive;

    if (this.wrapperEl) {
      this.wrapperEl.setAttribute(
        'data-lab-suggestion-active',
        this.isSuggestionTooltipActive ? 'true' : 'false'
      );
    }
  }

  getTeiPasajeContainer() {
    return this.getActiveUI()?.pasajeContent?.querySelector('#tei-pasaje')
      || document.querySelector('[data-lab-shell][data-shell-visible="true"] #tei-pasaje')
      || document.getElementById('tei-pasaje');
  }

  getPasajeContainer() {
    return this.getActiveUI()?.pasajeContainer
      || document.querySelector('[data-lab-shell][data-shell-visible="true"] [data-lab-pasaje-container]')
      || document.querySelector('.pasaje-container');
  }

  isNarrowLayout() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches;
  }

  scrollPasajeToStart() {
    const pasajeContainer = this.getPasajeContainer();
    if (!pasajeContainer) return;
    pasajeContainer.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  getPrimerIndiceNotaPendiente() {
    for (let i = 0; i < this.notasPasaje.length; i++) {
      if (!this.notasEvaluadas.has(buildNoteEvaluationKey(this.notasPasaje[i].nota_id, this.notasPasaje[i].nota_change))) {
        return i;
      }
    }

    return this.notasPasaje.length > 0 ? 0 : -1;
  }

  actualizarModoBadges(etiqueta) {
    setPassageModeBadges(this.getAllUIs(), etiqueta);
  }

  actualizarBotonNotasSheet() {
    const toggleButton = this.ui.mobile?.btnNotesToggle;
    syncLaboratorioNoteToggle(toggleButton, {
      hasNotes: this.notasPasaje.length > 0,
      isExpanded: this.isNarrowLayout() && this.isNoteSheetOpen
    });
  }

  syncResponsiveState() {
    const previousShell = this.activeShell;
    const isNarrow = this.isNarrowLayout();
    this.activeShell = this.getActiveShell();
    const shellChanged = previousShell !== this.activeShell;
    const activeUI = this.refreshActiveUIRefs();

    if (!isNarrow) {
      this.isNoteSheetOpen = false;
      this.resetMobileNoteSheetDrag();
    }

    if (this.wrapperEl) {
      this.wrapperEl.setAttribute('data-lab-layout', isNarrow ? 'narrow' : 'wide');
      this.wrapperEl.setAttribute(
        'data-lab-notes-open',
        isNarrow && this.isNoteSheetOpen ? 'true' : 'false'
      );
    }

    this.setSuggestionTooltipActive(this.isSuggestionTooltipActive && isNarrow && !this.isNoteSheetOpen);

    this.getAllUIs().forEach((ui) => {
      ui.root.setAttribute('data-shell-visible', ui === activeUI ? 'true' : 'false');
    });

    const mobileUI = this.ui.mobile;
    if (mobileUI?.noteColumn) {
      mobileUI.noteColumn.setAttribute('aria-hidden', 'false');
    }
    if (mobileUI?.noteSheet) {
      mobileUI.noteSheet.setAttribute(
        'aria-hidden',
        isNarrow ? String(!this.isNoteSheetOpen) : 'true'
      );
    }
    if (mobileUI?.notesBackdrop) {
      mobileUI.notesBackdrop.hidden = !(isNarrow && this.isNoteSheetOpen);
    }

    this.actualizarBotonNotasSheet();
    return shellChanged;
  }

  openNoteSheet(options = {}) {
    const preferPending = !!options.preferPending;

    if (!this.notasPasaje.length) {
      this.isNoteSheetOpen = false;
      this.syncResponsiveState();
      return false;
    }

    if (this.isNarrowLayout()) {
      this.resetMobileNoteSheetDrag();
      if (window.sugerenciasNotas?.ocultarTooltip) {
        window.sugerenciasNotas.ocultarTooltip();
      }
      this.setSuggestionTooltipActive(false);

      let targetIndex = this.notaActualIndex;
      const currentNote = targetIndex >= 0 ? this.notasPasaje[targetIndex] : null;

      if (
        targetIndex < 0 ||
        !currentNote ||
        (preferPending && this.notasEvaluadas.has(buildNoteEvaluationKey(currentNote.nota_id, currentNote.nota_change)))
      ) {
        targetIndex = preferPending ? this.getPrimerIndiceNotaPendiente() : 0;
      }

      if (targetIndex >= 0 && targetIndex !== this.notaActualIndex) {
        this.navegarANota(targetIndex, { openSheet: false });
      }

      this.isNoteSheetOpen = true;
      this.syncResponsiveState();
    }

    return true;
  }

  closeNoteSheet(options = {}) {
    const focusPasaje = !!options.focusPasaje;
    const focusFooter = !!options.focusFooter;

    this.labNoteViewTracker?.flush('note_sheet_closed');
    this.resetMobileNoteSheetDrag();
    this.isNoteSheetOpen = false;
    this.syncResponsiveState();

    if (focusPasaje) {
      this.getPasajeContainer()?.focus({ preventScroll: true });
      return;
    }

    if (focusFooter) {
      this.ui.mobile?.btnNotesToggle?.focus({ preventScroll: true });
    }
  }

  toggleNoteSheet() {
    if (this.isNarrowLayout() && this.isNoteSheetOpen) {
      this.closeNoteSheet({ focusPasaje: true });
      return;
    }

    this.openNoteSheet({ preferPending: true });
  }

  resetMobileNoteSheetDrag() {
    this.mobileSheetDragController?.reset();
  }

  setupTextZoomController() {
    if (this.textZoomController) {
      this.textZoomController.sync();
      this.labFontSizePercent = this.textZoomController.getPercent();
      return;
    }

    this.textZoomController = createTextZoomController({
      target: () => this.getTeiPasajeContainer(),
      display: this.ui.desktop?.fontDisplay || document.getElementById('lab-font-size-display'),
      defaultPercent: this.labFontSizePercent,
      minPercent: this.labFontMin,
      maxPercent: this.labFontMax,
      stepPercent: this.labFontStep,
      onAfterApply: ({ percent }) => {
        this.labFontSizePercent = percent;
      },
      canIncrease: () => !this.tieneOverflowHorizontalPasaje()
    });

    this.labFontSizePercent = this.textZoomController.getPercent();
  }

  actualizarDisplayZoomPasaje() {
    if (!this.textZoomController) return;
    this.textZoomController.sync();
    this.labFontSizePercent = this.textZoomController.getPercent();
  }

  aplicarZoomPasaje(percent) {
    if (!this.textZoomController) return null;
    const result = this.textZoomController.setPercent(percent);
    this.labFontSizePercent = this.textZoomController.getPercent();
    return result;
  }

  tieneOverflowHorizontalPasaje() {
    const pasajeContainer = this.getPasajeContainer();
    const teiContainer = this.getTeiPasajeContainer();

    if (!pasajeContainer || !teiContainer) return false;

    return (
      teiContainer.scrollWidth > teiContainer.clientWidth + 1 ||
      pasajeContainer.scrollWidth > pasajeContainer.clientWidth + 1
    );
  }

  ajustarZoomHastaNoOverflow() {
    let safety = 0;
    while (this.tieneOverflowHorizontalPasaje() && this.labFontSizePercent > this.labFontMin && safety < 40) {
      this.aplicarZoomPasaje(this.labFontSizePercent - this.labFontStep);
      safety += 1;
    }
  }

  intentarAumentarZoomSinOverflow() {
    if (!this.textZoomController) return;

    const result = this.textZoomController.increase();
    this.labFontSizePercent = this.textZoomController.getPercent();

    if (!result.ok && result.reason === 'max') {
      mostrarToast('Tamaño máximo alcanzado', 1400);
      return;
    }

    if (!result.ok && result.reason === 'blocked') {
      mostrarToast('No se puede aumentar más sin desbordar', 1600);
    }
  }

  /**
   * Mostrar pantalla de bienvenida
   */
  mostrarPantallaBienvenida() {
    this.aplicarEstadoVista('welcome');
    this.closeNoteSheet();
    this.pasajeActual = null;
    this.fragmentoActual = null;

    if (this.bienvenidaContainer) {
      this.bienvenidaContainer.style.display = 'flex';
    }
    this.layoutEls.forEach((layout) => layout.classList.remove('active'));
  }

  /**
   * Ocultar pantalla de bienvenida y mostrar laboratorio
   */
  ocultarPantallaBienvenida() {
    this.aplicarEstadoVista('mode');
    this.syncResponsiveState();

    if (this.bienvenidaContainer) {
      this.bienvenidaContainer.style.display = 'none';
    }
    this.layoutEls.forEach((layout) => layout.classList.add('active'));
  }

  async prepararSesionAntesDeIniciarLaboratorio() {
    if (window.Participacion?.session?.init) {
      await window.Participacion.session.init();
    }
    return true;
  }

  async iniciarModoDesdeBienvenida(modo) {
    if (modo !== 'secuencial' && modo !== 'aleatorio') return;

    await this.prepararSesionAntesDeIniciarLaboratorio();

    if (!this.isSessionPage) {
      this.clearStoredSession();
      this.sessionStartedAt = Date.now();
      this.sessionStats = { notasEvaluadas: 0 };
      const sessionPayload = {
        modo,
        pasajesVisitados: [],
        stats: this.sessionStats,
        startedAt: this.sessionStartedAt,
        updatedAt: this.sessionStartedAt
      };

      if (modo === 'secuencial') {
        sessionPayload.pasajeActualIndex = 0;
      }

      this.sessionStorage.write(sessionPayload);
      this.navigateAllowingSessionExit(this.getSessionUrl(modo));
      return;
    }

    if (modo === 'secuencial') {
      await this.iniciarModoSecuencial();
      return;
    }

    await this.iniciarModoAleatorio();
  }

  async iniciarSesionActivaDesdeRuta() {
    const storedSession = this.readStoredSession();
    const requestedMode = this.getRequestedMode();
    const modo = requestedMode || storedSession?.modo || null;
    const compatibleStoredSession = !requestedMode || storedSession?.modo === requestedMode
      ? storedSession
      : null;

    if (modo !== 'secuencial' && modo !== 'aleatorio') {
      this.navigateAllowingSessionExit(this.getLobbyUrl());
      return;
    }

    const initialIndex = Number.isInteger(Number(compatibleStoredSession?.pasajeActualIndex))
      ? Math.max(0, Math.min(this.pasajes.length - 1, Number(compatibleStoredSession.pasajeActualIndex)))
      : undefined;

    this.restoreSessionMetadata(compatibleStoredSession || {
      modo,
      pasajeActualIndex: initialIndex,
      startedAt: Date.now(),
      updatedAt: Date.now()
    });

    if (modo === 'secuencial') {
      await this.iniciarModoSecuencial({
        initialIndex: Number.isInteger(initialIndex) ? initialIndex : 0,
        preserveSession: true
      });
      return;
    }

    await this.iniciarModoAleatorio({
      ...(Number.isInteger(initialIndex) ? { initialIndex } : {}),
      preserveSession: true
    });
  }

  /**
   * Setup listeners para botones de modo
   */
  setupBienvenidaListeners() {
    const botonesModo = document.querySelectorAll('[data-lab-start-mode]');
    
    botonesModo.forEach(boton => {
      boton.addEventListener('click', () => {
        const modo = boton.dataset.modo;
        void this.iniciarModoDesdeBienvenida(modo);
      });
    });
  }

  /**
   * Iniciar modo secuencial
   */
  async iniciarModoSecuencial(options = {}) {
    if (!this.isSessionPage) {
      await this.iniciarModoDesdeBienvenida('secuencial');
      return;
    }

    this.modoNavegacion = 'secuencial';
    if (!options.preserveSession) {
      this.pasajesVisitados.clear();
    }
    this.ocultarPantallaBienvenida();
    this.actualizarModoControlesFranja('secuencial');
    
    // Actualizar badge de modo
    this.actualizarModoBadges('Secuencial');
    
    // Mostrar barra de progreso
    setPassageProgressVisibility(this.getAllUIs(), true);
    
    // Mostrar botón anterior
    setPreviousPassageVisibility(this.getAllUIs(), true);

    this.actualizarBotonesNavegacionPasajes();
    this.actualizarBotonNotasSheet();
    // Cargar primer pasaje
    await this.cargarPasaje(Number.isInteger(options.initialIndex) ? options.initialIndex : 0);
  }

  /**
   * Iniciar modo aleatorio
   */
  async iniciarModoAleatorio(options = {}) {
    if (!this.isSessionPage) {
      await this.iniciarModoDesdeBienvenida('aleatorio');
      return;
    }

    this.modoNavegacion = 'aleatorio';
    if (!options.preserveSession) {
      this.pasajesVisitados.clear();
    }
    this.ocultarPantallaBienvenida();
    this.actualizarModoControlesFranja('aleatorio');
    
    // Actualizar badge de modo
    this.actualizarModoBadges('Aleatorio');
    
    // Ocultar barra de progreso
    setPassageProgressVisibility(this.getAllUIs(), false);
    
    // Ocultar botón anterior
    setPreviousPassageVisibility(this.getAllUIs(), false);

    this.actualizarBotonesNavegacionPasajes();
    this.actualizarBotonNotasSheet();
    if (Number.isInteger(options.initialIndex)) {
      await this.cargarPasaje(options.initialIndex);
      return;
    }

    // Cargar pasaje aleatorio
    await this.cargarPasajeAleatorio();
  }

  /**
   * Cargar un pasaje aleatorio no visitado
   */
  async cargarPasajeAleatorio() {
    // Obtener pasajes no visitados
    const pasajesDisponibles = this.pasajes.filter((_, index) => 
      !this.pasajesVisitados.has(index)
    );

    if (pasajesDisponibles.length === 0) {
      // Todos visitados - resetear o mostrar finalización
      const shouldRestart = await this.confirmFeedback({
        title: 'Has visitado todos los pasajes',
        message: 'Puedes volver a empezar o cerrar esta sesi\u00f3n del laboratorio.',
        confirmText: 'Volver a empezar',
        cancelText: 'Cerrar',
        variant: 'warning'
      });

      if (shouldRestart) {
        this.pasajesVisitados.clear();
        await this.cargarPasajeAleatorio();
      } else {
        this.mostrarFinalizacion();
      }
      return;
    }

    // Elegir pasaje aleatorio
    const pasajeAleatorio = pasajesDisponibles[
      Math.floor(Math.random() * pasajesDisponibles.length)
    ];
    
    const indexAleatorio = this.pasajes.indexOf(pasajeAleatorio);
    await this.cargarPasaje(indexAleatorio);
  }

  /**
   * Actualizar barra de progreso (solo modo secuencial)
   */
  actualizarBarraProgreso() {
    syncPassageProgress(this.getAllUIs(), {
      mode: this.modoNavegacion,
      currentIndex: this.pasajeActualIndex,
      passageCount: this.pasajes.length
    });
  }

  /**
   * Actualizar barra de progreso de notas
   * Usa el estado interno (notas evaluadas / total) para el porcentaje
   */
  actualizarBarraProgresoNotas() {
    syncLaboratorioNoteProgress(this.getAllUIs(), {
      evaluatedCount: this.notasEvaluadas?.size || 0,
      noteCount: this.notasPasaje.length
    });
  }

  /**
   * Cargar lista de pasajes desde asset estático
   */
  async cargarPasajes() {
    try {
      const response = await fetch(LAB_PASAJES_URL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.pasajes = Array.isArray(data)
        ? data.slice().sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0))
        : [];
    } catch (error) {
      console.error('Error al cargar pasajes:', error);
      this.pasajes = [];
      this.notifyFeedback('Error al cargar pasajes. Verifica el asset local.', 'error', 3200);
      return;
    }

    this.setTextForAll('[data-lab-passages-total]', this.pasajes.length);
    console.log(`${this.pasajes.length} pasajes cargados`);
  }

  /**
   * Cargar un pasaje especifico
   */
  async cargarPasaje(index) {
    if (index < 0 || index >= this.pasajes.length) {
      this.flushCurrentPilotState('passage_finished');
      console.log('Fin de pasajes alcanzado');
      this.mostrarFinalizacion();
      return;
    }

    this.flushCurrentPilotState('passage_changed');
    this.pasajeActualIndex = index;
    
    // Marcar como visitado (para modo aleatorio)
    this.pasajesVisitados.add(index);
    
    // Reset estado de notas
    this.notasPasaje = [];
    this.notaActualIndex = -1;
    this.notasEvaluadas.clear();
    this.isNoteSheetOpen = false;
    this.currentPassageHadAction = false;

    const pasaje = this.pasajes[index];
    this.pasajeActual = pasaje;
    const persistedNoteKeys = Array.isArray(this.sessionEvaluatedByPassage[pasaje.id])
      ? this.sessionEvaluatedByPassage[pasaje.id]
      : [];
    this.notasEvaluadas = new Set(persistedNoteKeys);

    // Actualizar UI
    this.setTextForAll('[data-lab-passage-current]', index + 1);
    
    // Actualizar barra de progreso (solo modo secuencial)
    this.actualizarBarraProgreso();
    
    // Actualizar botones de navegación
    this.actualizarBotonesNavegacionPasajes();
    this.actualizarBotonNotasSheet();
    this.syncResponsiveState();

    // Extraer fragmento del XML
    const fragmento = extraerFragmento(this.xmlDoc, pasaje);

    if (!fragmento) {
      console.error('No se pudo extraer el fragmento');
      return;
    }

    this.fragmentoActual = fragmento;
    this.refreshActiveUIRefs();
    this.clearInactiveShells();

    // Renderizar con CETEI
    await this.renderizarPasaje(fragmento, pasaje);
    this.scrollPasajeToStart();

    // Cargar notas y aplicar highlights
    await this.cargarYAplicarNotas(fragmento, pasaje);

    // Actualizar barra de progreso de notas
    this.actualizarBarraProgresoNotas();
    this.persistSession();
  }

  /**
   * Renderizar pasaje con CETEI
   */
  async renderizarPasaje(fragmento, pasaje) {
    this.pasajeContent.innerHTML = '';

    // Anadir titulo del pasaje
    const titulo = document.createElement('h2');
    titulo.className = 'lab-pasaje-titulo';
    titulo.textContent = pasaje.titulo;
    this.pasajeContent.appendChild(titulo);

    // Anadir descripcion si existe
    if (pasaje.descripcion) {
      const descripcion = document.createElement('p');
      descripcion.className = 'lab-pasaje-descripcion';
      descripcion.textContent = pasaje.descripcion;
      this.pasajeContent.appendChild(descripcion);
    }

    // Asegurar CETEI
    const okCetei = await this.asegurarCETEI();
    if (!okCetei || typeof window.CETEI === 'undefined') {
      throw new Error('CETEI.js no esta cargado.');
    }

    // Crear documento temporal para CETEI
    const xmlStr = new XMLSerializer().serializeToString(fragmento);
    const parser = new DOMParser();
    const tempDoc = parser.parseFromString(xmlStr, 'text/xml');

    // Renderizar XML con CETEI
    const cetei = new window.CETEI();
    const htmlContent = cetei.domToHTML5(tempDoc);

    // Crear contenedor para el contenido TEI
    const teiContainer = document.createElement('div');
    teiContainer.id = 'tei-pasaje';
    teiContainer.className = 'lab-tei-pasaje';
    teiContainer.appendChild(htmlContent);

    this.pasajeContent.appendChild(teiContainer);

    // Aplicar alineacion de versos partidos y numeración de versos
    setTimeout(() => {
      alignSplitVerses(teiContainer);
      aplicarNumeracionVersos(teiContainer, 'cada5');
      this.aplicarZoomPasaje(this.labFontSizePercent);
      this.ajustarZoomHastaNoOverflow();
    }, 100);

    console.log('Pasaje renderizado:', pasaje.titulo);
  }

  /**
   * Cargar notas del pasaje y aplicar highlights al texto
   */
  async cargarYAplicarNotas(fragmento, pasaje) {
    // Obtener xml:ids del fragmento
    const xmlIds = extraerXmlIdsDelFragmento(fragmento);

    // Cargar todas las notas activas
    const todasNotas = await cargarNotasActivas();

    // Filtrar notas que aplican a este pasaje
    this.notasPasaje = filtrarNotasPorXmlIds(todasNotas, xmlIds);

    console.log(`${this.notasPasaje.length} notas para el pasaje ${pasaje.titulo}`);

    // Actualizar contadores
    this.actualizarContadores();

    // Aplicar highlights al texto
    this.aplicarHighlights();

    // Mostrar estado inicial del panel de notas
    if (this.notasPasaje.length === 0) {
      this.renderizarEstadoNotaPanel(
        'No hay notas en este pasaje',
        'Sin evaluaciones disponibles en este pasaje'
      );
    } else {
      // Activar siempre la primera nota al entrar en cada pasaje.
      // No abrimos el sheet movil ni hacemos auto-scroll del pasaje.
      this.navegarANota(0, { openSheet: false, autoScroll: false });
    }

    this.actualizarBotonNotasSheet();
    this.syncResponsiveState();
  }

  renderizarEstadoNotaPanel(mensajeContenido, mensajeDock) {
    if (!this.notaContent) return;
    renderNotePlaceholder(this.notaContent, {
      bodyMessage: mensajeContenido,
      dockMessage: mensajeDock,
      dockState: mensajeDock ? 'error' : 'idle'
    });

    this.actualizarBotonNotasSheet();
  }

  /**
   * Aplicar highlights al texto basandose en las notas de Supabase
   */
  aplicarHighlights() {
    const teiContainer = this.getTeiPasajeContainer();
    if (!teiContainer) return;

    applyNoteHighlights(teiContainer, this.notasPasaje, {
      getTarget: nota => nota.target || '',
      getNoteId: nota => nota.nota_id || '',
      propagateGroups: false,

      onWrapperClick: ({ groups }) => {
        const idx = this.notasPasaje.findIndex(n => n.nota_id === groups[0]);
        if (idx >= 0) this.navegarANota(idx);
      },

      onWrapperEnter: ({ groups }) => {
        if (groups[0]) highlightNoteInText(teiContainer, groups[0], true);
      },

      onWrapperLeave: ({ groups }) => {
        const noteId = groups[0];
        const notaActual = this.notasPasaje[this.notaActualIndex];
        if (!notaActual || notaActual.nota_id !== noteId) {
          highlightNoteInText(teiContainer, noteId, false);
        }
      }
    });

    aplicarNumeracionVersos(teiContainer, 'cada5');
    this.ajustarZoomHastaNoOverflow();

    console.log('Highlights aplicados');
  }

  /**
   * Marcar nota actual en el texto
   */
  marcarNotaActualEnTexto(notaId, options = {}) {
    const teiContainer = this.getTeiPasajeContainer();
    if (!teiContainer) return;
    markCurrentNoteInText(teiContainer, notaId, {
      clearAllActive: true,
      autoScroll: options.autoScroll !== false
    });
  }

  /**
   * Navegar a una nota especifica por indice
   */
  navegarANota(index, options = {}) {
    if (index < 0 || index >= this.notasPasaje.length) return;

    const shouldOpenSheet = options.openSheet !== false && this.isNarrowLayout();
    this.notaActualIndex = index;
    const nota = this.notasPasaje[index];

    // Actualizar indicador de posicion
    this.setTextForAll('[data-lab-note-index]', index + 1);

    // Marcar en el texto
    this.marcarNotaActualEnTexto(nota.nota_id, {
      autoScroll: options.autoScroll !== false
    });

    // Actualizar botones de navegacion
    this.actualizarBotonesNavegacion();

    // Renderizar la nota
    this.renderizarNotaActual(nota);

    // Actualizar barra de progreso de notas
    this.actualizarBarraProgresoNotas();
    if (shouldOpenSheet) {
      this.isNoteSheetOpen = true;
      this.syncResponsiveState();
    } else {
      this.actualizarBotonNotasSheet();
    }
  }

  /**
   * Renderizar la nota actual en el panel lateral
   */
  renderizarNotaActual(nota) {
    const pasajeId = this.pasajes[this.pasajeActualIndex]?.id;
    const noteKey = buildNoteEvaluationKey(nota.nota_id, nota.nota_change);
    const yaEvaluada = this.notasEvaluadas.has(noteKey);

    const badgesHTML = buildNoteBadgesHTML(nota.ana);

    // Obtener estadisticas de evaluaciones
    const evaluaciones = typeof obtenerEvaluacionesStats === 'function'
      ? obtenerEvaluacionesStats(nota.nota_id, nota, nota.nota_change)
      : { total: 0, utiles: 0, mejorables: 0 };

    const noteDisplayHtml = buildNoteDisplayHTML({
      noteId: nota.nota_id,
      noteChange: nota.nota_change,
      text: nota.texto_nota,
      badgesHTML
    });

    renderNotePanel(this.notaContent, {
      currentNoteId: nota.nota_id,
      currentNoteChange: nota.nota_change || '',
      dockState: yaEvaluada ? 'evaluated' : 'loading',
      bodyHTML: noteDisplayHtml,
      dockHTML: yaEvaluada
        ? '<div class="nota-ya-evaluada"><i class="fa-solid fa-check-circle" aria-hidden="true"></i> Nota evaluada</div>'
        : ''
    });
    if (this.labNoteViewTracker) {
      this.labNoteViewTracker.show({
        noteId: nota.nota_id,
        noteChange: nota.nota_change,
        pasajeId,
        reason: 'note_changed'
      });
      if (yaEvaluada) {
        this.labNoteViewTracker.markEvaluated(nota.nota_id, nota.nota_change);
      }
    }
    void hydrateCbRefsInContainer(this.notaContent);

    this.actualizarBotonNotasSheet();

    if (yaEvaluada) return;

    const dock = this.notaContent.querySelector('.note-eval-dock') || this.notaContent;
    void mountNoteEvaluationDock({
      dockEl: dock,
      noteId: nota.nota_id,
      noteChange: nota.nota_change,
      counts: evaluaciones,
      noteData: nota,
      source: 'laboratorio',
      pasajeId,
      scopeEl: this.notaContent,
      alreadyEvaluated: false,
      onSuccess: ({ noteId: currentNoteId, noteChange: currentNoteChange }) => {
        this.marcarNotaComoEvaluada(currentNoteId, currentNoteChange);
        this.avanzarSiguienteNotaPendiente();
      },
      onError: () => {
        if (!dock.isConnected) return;
        dock.dataset.evalState = 'error';
      }
    });
  }
  /**
   * Marcar nota como evaluada
   */
  marcarNotaComoEvaluada(notaId, noteChange) {
    const noteKey = buildNoteEvaluationKey(notaId, noteChange);
    const wasPending = !this.notasEvaluadas.has(noteKey);
    this.notasEvaluadas.add(noteKey);
    this.currentPassageHadAction = true;
    this.labNoteViewTracker?.markEvaluated(notaId, noteChange);
    if (wasPending) {
      const pasajeId = this.pasajeActual?.id || this.pasajes[this.pasajeActualIndex]?.id || '';
      if (pasajeId) {
        const currentKeys = new Set(
          Array.isArray(this.sessionEvaluatedByPassage[pasajeId])
            ? this.sessionEvaluatedByPassage[pasajeId]
            : []
        );
        currentKeys.add(noteKey);
        this.sessionEvaluatedByPassage[pasajeId] = Array.from(currentKeys);
      }
      this.sessionStats.notasEvaluadas = Number(this.sessionStats.notasEvaluadas || 0) + 1;
      this.persistSession();
    }
    this.actualizarContadores();
    
    // Re-renderizar la nota actual para mostrar estado evaluado
    const nota = this.notasPasaje.find(n => n.nota_id === notaId);
    if (nota) {
      this.renderizarNotaActual(nota);
      this.actualizarBotonNotasSheet();
    }

    mostrarToast('Evaluación guardada', 2000);
  }

  flushCurrentPilotState(reason) {
    this.labNoteViewTracker?.flush(reason || 'unknown');
    this.trackCurrentPassageSkipped(reason || 'unknown');
  }

  trackCurrentPassageSkipped(reason) {
    if (!window.Participacion?.pilotTracking?.track) return;
    if (!this.pasajeActual) return;
    if (this.currentPassageHadAction) return;

    const pasajeId = Number.isInteger(this.pasajeActual.id)
      ? this.pasajeActual.id
      : Number.parseInt(String(this.pasajeActual.id || ''), 10);
    if (!Number.isInteger(pasajeId)) return;

    void window.Participacion.pilotTracking.track(
      window.Participacion.pilotTracking.EVENTS.LAB_PASSAGE_SKIPPED,
      {
        context: 'laboratorio',
        pasajeId,
        eventKey: `lab_passage_skipped:${pasajeId}`,
        metadata: {
          reason: String(reason || 'unknown').slice(0, 80),
          mode: this.modoNavegacion || null,
          passage_index: this.pasajeActualIndex,
          notes_total: this.notasPasaje.length
        }
      }
    );
  }

  /**
   * Avanzar a la siguiente nota pendiente de evaluar
   */
  avanzarSiguienteNotaPendiente() {
    // Buscar siguiente nota no evaluada
    for (let i = this.notaActualIndex + 1; i < this.notasPasaje.length; i++) {
      if (!this.notasEvaluadas.has(buildNoteEvaluationKey(this.notasPasaje[i].nota_id, this.notasPasaje[i].nota_change))) {
        setTimeout(() => this.navegarANota(i), 500);
        return;
      }
    }

    // Si no hay mas, buscar desde el principio
    for (let i = 0; i < this.notaActualIndex; i++) {
      if (!this.notasEvaluadas.has(buildNoteEvaluationKey(this.notasPasaje[i].nota_id, this.notasPasaje[i].nota_change))) {
        setTimeout(() => this.navegarANota(i), 500);
        return;
      }
    }

    // Todas evaluadas
    if (this.notasEvaluadas.size === this.notasPasaje.length) {
      setTimeout(() => {
        if (this.isNarrowLayout()) {
          this.closeNoteSheet();
        }
        this.getActiveUI()?.btnNextPassage?.focus({ preventScroll: true });
        mostrarToast('¡Pasaje completado!', 3000);
      }, 600);
    }
  }

  /**
   * Actualizar contadores de notas
   */
  actualizarContadores() {
    const total = this.notasPasaje.length;
    const evaluadas = this.notasEvaluadas.size;
    syncLaboratorioNoteCounters(this.getAllUIs(), {
      currentIndex: this.notaActualIndex,
      evaluatedCount: evaluadas,
      noteCount: total
    });

    // Actualizar barra de progreso de notas tras cambiar contadores
    this.actualizarBarraProgresoNotas();
    this.actualizarBotonNotasSheet();
  }

  /**
   * Actualizar estado de botones de navegacion
   */
  actualizarBotonesNavegacion() {
    syncLaboratorioNoteNavigation(this.getAllUIs(), {
      currentIndex: this.notaActualIndex,
      noteCount: this.notasPasaje.length
    });
  }

  getSessionSummary() {
    return {
      modo: this.modoNavegacion === 'aleatorio' ? 'Aleatorio' : 'Secuencial',
      pasajesVisitados: this.pasajesVisitados.size,
      pasajesTotales: this.pasajes.length,
      notasEvaluadas: Number(this.sessionStats.notasEvaluadas || 0)
    };
  }

  renderSessionSummaryHtml() {
    const summary = this.getSessionSummary();
    return `
      <div class="modal-header has-content">
        <div class="modal-header-main">
          <h2 id="laboratorio-salida-titulo">Resumen de la sesión</h2>
          <p class="modal-descripcion mb-0">Puedes continuar o salir del laboratorio.</p>
        </div>
      </div>
      <div class="row g-2 my-3">
        <div class="col-6">
          <div class="border rounded-3 p-3 h-100">
            <div class="text-quiet small">Modo</div>
            <div class="fw-semibold">${summary.modo}</div>
          </div>
        </div>
        <div class="col-6">
          <div class="border rounded-3 p-3 h-100">
            <div class="text-quiet small">Pasajes</div>
            <div class="fw-semibold">${summary.pasajesVisitados}/${summary.pasajesTotales}</div>
          </div>
        </div>
        <div class="col-12">
          <div class="border rounded-3 p-3">
            <div class="text-quiet small">Notas evaluadas</div>
            <div class="fw-semibold">${summary.notasEvaluadas}</div>
          </div>
        </div>
      </div>
      <div class="modal-actions d-flex flex-wrap gap-2 justify-content-end">
        <button type="button" class="btn btn-outline-action" data-lab-exit-action="continue">Continuar</button>
        <button type="button" class="btn btn-muted" data-lab-exit-action="change-mode">Cambiar modo</button>
        <button type="button" class="btn btn-action" data-lab-exit-action="exit">Salir</button>
      </div>
    `;
  }

  showSessionExitSummary() {
    if (!window.Participacion?.modalShell?.create) {
      return Promise.resolve('exit');
    }

    if (this.sessionExitModal?.modal?.isConnected) {
      this.sessionExitModal.close();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (action) => {
        if (resolved) return;
        resolved = true;
        this.sessionExitModal?.close();
        resolve(action);
      };

      this.sessionExitModal = window.Participacion.modalShell.create({
        modalClassName: 'laboratorio-exit-summary',
        contentClassName: 'laboratorio-exit-summary-content',
        labelledBy: 'laboratorio-salida-titulo',
        closeButtonClassName: 'btn-circular modal-shell-close',
        closeButtonLabel: 'Cerrar resumen',
        closeButtonHtml: '<i class="fa-solid fa-xmark" aria-hidden="true"></i>',
        destroyOnClose: true,
        bodyHtml: this.renderSessionSummaryHtml(),
        onRequestClose: () => finish('continue')
      });

      this.sessionExitModal.modal.querySelectorAll('[data-lab-exit-action]').forEach((button) => {
        button.addEventListener('click', () => {
          finish(button.getAttribute('data-lab-exit-action') || 'continue');
        });
      });

      this.sessionExitModal.open();
    });
  }

  async solicitarSalidaSesion(options = {}) {
    if (!this.isSessionPage || this.allowSessionNavigation || this.sessionExitPending) return;

    this.sessionExitPending = true;
    this.persistSession();
    const action = await this.showSessionExitSummary();
    this.sessionExitPending = false;

    if (action === 'continue') return;

    if (action === 'change-mode') {
      this.clearStoredSession();
      this.navigateAllowingSessionExit(this.getLobbyUrl());
      return;
    }

    if (options.clearSessionOnExit) {
      this.clearStoredSession();
    }
    this.navigateAllowingSessionExit(options.destination || this.getLobbyUrl());
  }

  setupSessionExitGuards() {
    if (!this.isSessionPage) return;

    window.history.replaceState(
      Object.assign({}, window.history.state || {}, { laboratorioSesion: true }),
      '',
      window.location.href
    );
    window.history.pushState({ laboratorioSesionGuard: true }, '', window.location.href);

    window.addEventListener('popstate', () => {
      if (this.allowSessionNavigation) return;
      window.history.pushState({ laboratorioSesionGuard: true }, '', window.location.href);
      void this.solicitarSalidaSesion({ destination: this.getLobbyUrl() });
    });

    window.addEventListener('beforeunload', (event) => {
      if (this.allowSessionNavigation) return;
      this.labNoteViewTracker?.flush('beforeunload');
      this.persistSession();
      event.preventDefault();
      event.returnValue = '';
    });

    window.addEventListener('pagehide', () => {
      this.labNoteViewTracker?.flush('pagehide');
      this.persistSession();
    });

    document.addEventListener('click', (event) => {
      if (this.allowSessionNavigation) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;

      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const destination = new URL(href, window.location.href);
      if (destination.href === window.location.href) return;
      if (destination.origin !== window.location.origin) return;

      event.preventDefault();
      void this.solicitarSalidaSesion({ destination: destination.toString() });
    }, true);
  }

  /**
   * Registrar evaluacion en Supabase (delega a función compartida)
   */
  /**
   * Configurar event listeners de controles
   */
  setupEventListeners() {
    this.getAllUIs().forEach((ui) => {
      ui.btnPrevNote?.addEventListener('click', () => {
        if (this.notaActualIndex > 0) {
          this.navegarANota(this.notaActualIndex - 1);
        }
      });

      ui.btnNextNote?.addEventListener('click', () => {
        if (this.notaActualIndex < this.notasPasaje.length - 1) {
          this.navegarANota(this.notaActualIndex + 1);
        } else if (this.notaActualIndex === -1 && this.notasPasaje.length > 0) {
          this.navegarANota(0);
        }
      });

      ui.btnPrevPassage?.addEventListener('click', () => {
        this.pasajeAnterior();
      });

      ui.btnNextPassage?.addEventListener('click', () => {
        this.siguientePasaje();
      });

      ui.btnNotesToggle?.addEventListener('click', () => {
        this.toggleNoteSheet();
      });

      ui.btnNotesClose?.addEventListener('click', () => {
        this.closeNoteSheet({ focusPasaje: true });
      });

      ui.notesBackdrop?.addEventListener('click', () => {
        this.closeNoteSheet({ focusPasaje: true });
      });
    });

    // Botón cambiar modo
    document.querySelectorAll('[data-cambiar-modo]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (this.isSessionPage) {
          await this.solicitarSalidaSesion({
            destination: this.getLobbyUrl(),
            clearSessionOnExit: true
          });
          return;
        }

        const shouldChangeMode = await this.confirmFeedback({
          title: 'Cambiar modo',
          message: 'Volver\u00e1s a la pantalla de selecci\u00f3n para elegir de nuevo entre modo secuencial o aleatorio.',
          confirmText: 'Cambiar modo',
          cancelText: 'Cancelar',
          variant: 'warning'
        });

        if (shouldChangeMode) {
          this.volverABienvenida();
        }
      });
    });

    // Controles de zoom del pasaje
    this.ui.desktop?.fontIncrease?.addEventListener('click', () => {
      this.intentarAumentarZoomSinOverflow();
    });

    this.ui.desktop?.fontDecrease?.addEventListener('click', () => {
      if (!this.textZoomController) return;
      this.textZoomController.decrease();
      this.labFontSizePercent = this.textZoomController.getPercent();
    });

    // Revalidar overflow horizontal al cambiar tamaño de viewport
    window.addEventListener('resize', () => {
      if (this.resizeAdjustTimer) {
        clearTimeout(this.resizeAdjustTimer);
      }

      this.resizeAdjustTimer = setTimeout(async () => {
        const shellChanged = this.syncResponsiveState();
        if (shellChanged) {
          await this.rerenderActiveShell();
        }
        this.ajustarZoomHastaNoOverflow();
      }, 120);
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!this.isNarrowLayout() || !this.isNoteSheetOpen) return;
      event.preventDefault();
      this.closeNoteSheet({ focusPasaje: true });
    });

    window.addEventListener('participacion:missing-note-suggested', (event) => {
      const detail = event?.detail || {};
      if (detail.source !== 'laboratorio') return;
      this.currentPassageHadAction = true;
    });

    // Actualizar botones iniciales
    this.actualizarBotonesNavegacion();
  }

  bindParticipationStateListener() {
    if (this.participationStateListenerBound || typeof window === 'undefined') return;
    window.addEventListener('participacion:state-changed', this.handleParticipationStateChanged);
    this.participationStateListenerBound = true;
  }

  handleParticipationStateChanged(event) {
    const detail = event?.detail;
    if (!detail?.sessionChanged) return;

    this.notasEvaluadas.clear();
    this.actualizarContadores();

    const notaActual = this.notaActualIndex >= 0 ? this.notasPasaje[this.notaActualIndex] : null;
    if (notaActual) {
      this.renderizarNotaActual(notaActual);
    }

    this.actualizarBotonNotasSheet();
  }

  /**
   * Volver a la pantalla de bienvenida
   */
  volverABienvenida() {
    if (this.isSessionPage) {
      this.clearStoredSession();
      this.navigateAllowingSessionExit(this.getLobbyUrl());
      return;
    }

    this.modoNavegacion = null;
    this.pasajesVisitados.clear();
    this.actualizarModoControlesFranja(null);
    this.closeNoteSheet();
    this.mostrarPantallaBienvenida();
  }

  actualizarModoControlesFranja(modo) {
    setPassageModeAttributes(this.getAllUIs(), modo);
  }

  /**
   * Actualizar estado de botones de navegación de pasajes
   */
  actualizarBotonesNavegacionPasajes() {
    syncPassageNavigationButtons(this.getAllUIs(), {
      mode: this.modoNavegacion,
      currentIndex: this.pasajeActualIndex,
      passageCount: this.pasajes.length
    });
  }

  /**
   * Ir al pasaje anterior (solo modo secuencial)
   */
  pasajeAnterior() {
    if (this.modoNavegacion !== 'secuencial') return;
    
    if (this.pasajeActualIndex > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.scrollPasajeToStart();
      this.cargarPasaje(this.pasajeActualIndex - 1);
    }
  }

  /**
   * Ir al siguiente pasaje
   */
  siguientePasaje() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.scrollPasajeToStart();
    
    if (this.modoNavegacion === 'secuencial') {
      this.cargarPasaje(this.pasajeActualIndex + 1);
    } else if (this.modoNavegacion === 'aleatorio') {
      this.cargarPasajeAleatorio();
    }
  }

  /**
   * Mostrar pantalla de finalizacion
   */
  mostrarFinalizacion() {
    const layout = this.getActiveUI()?.root;
    if (!layout) return;

    this.closeNoteSheet();
    this.clearInactiveShells();
    layout.innerHTML = `
      <div class="container py-5 text-center">
        <div class="mx-auto d-grid gap-3" style="max-width: 600px;">
          <h1 class="display-5 fw-semibold mb-0">¡Felicidades!</h1>
          <p class="fs-4 text-quiet mb-0">
          Has completado todos los pasajes disponibles
          </p>
          <p class="fs-5 text-quiet mb-2">Gracias por tu contribución al proyecto</p>
          <a href="${this.getLobbyUrl()}" class="btn btn-action align-self-center">
            Volver al laboratorio
          </a>
        </div>
      </div>
    `;

    mostrarToast('Has completado todos los pasajes', 4000);
  }
}

// Inicializar cuando el DOM este listo
document.addEventListener('DOMContentLoaded', async () => {
  window.editorSocial = new EditorSocial();
  window.laboratorioNotas = window.editorSocial;
  await window.editorSocial.init();
});

console.log('Editor Social cargado');
