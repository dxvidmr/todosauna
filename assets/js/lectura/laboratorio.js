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
import {
  applyNoteHighlights,
  highlightNoteInText,
  markCurrentNoteInText,
  buildNoteBadgesHTML,
  buildNoteDisplayHTML
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
    // Zoom del pasaje (sesion actual)
    this.labFontSizePercent = DEFAULT_ZOOM_PERCENT;
    this.labFontMin = MIN_ZOOM_PERCENT;
    this.labFontMax = MAX_ZOOM_PERCENT;
    this.labFontStep = ZOOM_STEP_PERCENT;
    this.textZoomController = null;
    this.resizeAdjustTimer = null;
    this.participationStateListenerBound = false;
    this.mobileSheetDrag = {
      active: false,
      pointerId: null,
      startY: 0,
      currentDelta: 0,
      captureEl: null,
      resetTimer: null
    };
    this.handleParticipationStateChanged = this.handleParticipationStateChanged.bind(this);
    this.handleMobileSheetPointerMove = this.handleMobileSheetPointerMove.bind(this);
    this.handleMobileSheetPointerEnd = this.handleMobileSheetPointerEnd.bind(this);
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
    this.setupTextZoomController();
    this.syncResponsiveState();

    // Cargar pasajes desde asset estático derivado del XML
    await this.cargarPasajes();

    // Cargar XML de Fuenteovejuna (se cachea)
    const xmlPath = window.SITE_PATHS?.xml || '../assets/xml';
    this.xmlDoc = await cargarXMLCacheado(xmlPath + '/fuenteovejuna.xml');

    // Asegurar CETEI antes de renderizar
    const okCetei = await this.asegurarCETEI();
    if (!okCetei) {
      throw new Error('CETEI.js no esta cargado y no se pudo cargar dinamicamente.');
    }

    // Cargar estadísticas globales
    await this.cargarEstadisticasGlobales();

    // Mostrar pantalla de bienvenida
    this.mostrarPantallaBienvenida();

    // Event listeners para pantalla de bienvenida
    this.setupBienvenidaListeners();
    
    // Event listeners para controles del laboratorio
    this.setupEventListeners();
    this.bindParticipationStateListener();
    this.actualizarBotonNotasSheet();
    this.syncResponsiveState();

    console.log('Editor Social inicializado');
  }

  /**
   * Cargar estadísticas globales
   */
  async cargarEstadisticasGlobales() {
    const container = document.querySelector('.stats-globales');
    
    if (!container) {
      console.warn('Contenedor de estadísticas no encontrado');
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

  toggleDisplayForAll(selector, displayValue) {
    this.getAllUIs().forEach((ui) => {
      ui.root.querySelectorAll(selector).forEach((el) => {
        el.style.display = displayValue;
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
    document.querySelectorAll('[data-lab-mode-badge]').forEach((badge) => {
      badge.textContent = etiqueta;
    });
  }

  actualizarBotonNotasSheet() {
    const toggleButton = this.ui.mobile?.btnNotesToggle;
    if (!toggleButton) return;

    const labelEl = toggleButton.querySelector('[data-lab-note-toggle-label]');
    const hasNotes = this.notasPasaje.length > 0;

    toggleButton.disabled = !hasNotes;
    toggleButton.setAttribute(
      'aria-expanded',
      this.isNarrowLayout() && this.isNoteSheetOpen ? 'true' : 'false'
    );

    if (labelEl) {
      labelEl.textContent = 'Notas';
    }
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

  startMobileSheetDrag(event) {
    if (!this.isNarrowLayout() || !this.isNoteSheetOpen) return;
    if (event.button !== undefined && event.button !== 0) return;

    const noteSheet = this.ui.mobile?.noteSheet;
    if (!noteSheet) return;

    this.resetMobileSheetDragListeners();

    if (this.mobileSheetDrag.resetTimer) {
      clearTimeout(this.mobileSheetDrag.resetTimer);
      this.mobileSheetDrag.resetTimer = null;
    }

    this.mobileSheetDrag.active = true;
    this.mobileSheetDrag.pointerId = event.pointerId;
    this.mobileSheetDrag.startY = event.clientY;
    this.mobileSheetDrag.currentDelta = 0;
    this.mobileSheetDrag.captureEl = event.currentTarget instanceof Element ? event.currentTarget : null;

    noteSheet.classList.add('is-dragging');

    if (this.mobileSheetDrag.captureEl?.setPointerCapture) {
      try {
        this.mobileSheetDrag.captureEl.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Best effort.
      }
    }

    window.addEventListener('pointermove', this.handleMobileSheetPointerMove, { passive: false });
    window.addEventListener('pointerup', this.handleMobileSheetPointerEnd);
    window.addEventListener('pointercancel', this.handleMobileSheetPointerEnd);
    event.preventDefault();
  }

  handleMobileSheetPointerMove(event) {
    if (!this.mobileSheetDrag.active || event.pointerId !== this.mobileSheetDrag.pointerId) return;

    const noteSheet = this.ui.mobile?.noteSheet;
    if (!noteSheet) return;

    const delta = Math.max(0, event.clientY - this.mobileSheetDrag.startY);
    const backdrop = this.ui.mobile?.notesBackdrop;
    this.mobileSheetDrag.currentDelta = delta;

    noteSheet.style.transform = `translateY(${delta}px)`;
    noteSheet.style.opacity = String(Math.max(0.62, 1 - (delta / 360)));

    if (backdrop) {
      backdrop.style.opacity = String(Math.max(0, 1 - (delta / 220)));
    }

    event.preventDefault();
  }

  handleMobileSheetPointerEnd(event) {
    if (!this.mobileSheetDrag.active || event.pointerId !== this.mobileSheetDrag.pointerId) return;

    const noteSheet = this.ui.mobile?.noteSheet;
    const backdrop = this.ui.mobile?.notesBackdrop;
    const threshold = noteSheet
      ? Math.min(180, Math.max(84, noteSheet.offsetHeight * 0.2))
      : 96;
    const shouldClose = this.mobileSheetDrag.currentDelta >= threshold;

    if (this.mobileSheetDrag.captureEl?.releasePointerCapture) {
      try {
        this.mobileSheetDrag.captureEl.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Best effort.
      }
    }

    this.resetMobileSheetDragListeners();

    if (shouldClose) {
      this.closeNoteSheet({ focusPasaje: true });
      return;
    }

    if (noteSheet) {
      noteSheet.style.transform = 'translateY(0)';
      noteSheet.style.opacity = '1';
      noteSheet.classList.add('is-dragging');
    }

    if (backdrop) {
      backdrop.style.opacity = '1';
    }

    this.mobileSheetDrag.resetTimer = window.setTimeout(() => {
      this.resetMobileNoteSheetDrag();
    }, 220);
  }

  resetMobileSheetDragListeners() {
    window.removeEventListener('pointermove', this.handleMobileSheetPointerMove);
    window.removeEventListener('pointerup', this.handleMobileSheetPointerEnd);
    window.removeEventListener('pointercancel', this.handleMobileSheetPointerEnd);
  }

  resetMobileNoteSheetDrag() {
    const noteSheet = this.ui.mobile?.noteSheet;
    const backdrop = this.ui.mobile?.notesBackdrop;

    if (this.mobileSheetDrag.resetTimer) {
      clearTimeout(this.mobileSheetDrag.resetTimer);
      this.mobileSheetDrag.resetTimer = null;
    }

    this.resetMobileSheetDragListeners();

    if (noteSheet) {
      noteSheet.style.transform = '';
      noteSheet.style.opacity = '';
      noteSheet.classList.remove('is-dragging');
    }

    if (backdrop) {
      backdrop.style.opacity = '';
    }

    this.mobileSheetDrag.active = false;
    this.mobileSheetDrag.pointerId = null;
    this.mobileSheetDrag.startY = 0;
    this.mobileSheetDrag.currentDelta = 0;
    this.mobileSheetDrag.captureEl = null;
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

    if (modo === 'secuencial') {
      await this.iniciarModoSecuencial();
      return;
    }

    await this.iniciarModoAleatorio();
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
  async iniciarModoSecuencial() {
    this.modoNavegacion = 'secuencial';
    this.pasajesVisitados.clear();
    this.ocultarPantallaBienvenida();
    this.actualizarModoControlesFranja('secuencial');
    
    // Actualizar badge de modo
    this.actualizarModoBadges('Secuencial');
    
    // Mostrar barra de progreso
    this.toggleDisplayForAll('[data-lab-passage-progress-container]', 'block');
    
    // Mostrar botón anterior
    this.getAllUIs().forEach((ui) => {
      if (ui.btnPrevPassage) {
        ui.btnPrevPassage.style.display = 'inline-flex';
      }
    });

    this.actualizarBotonesNavegacionPasajes();
    this.actualizarBotonNotasSheet();
    // Cargar primer pasaje
    await this.cargarPasaje(0);
  }

  /**
   * Iniciar modo aleatorio
   */
  async iniciarModoAleatorio() {
    this.modoNavegacion = 'aleatorio';
    this.pasajesVisitados.clear();
    this.ocultarPantallaBienvenida();
    this.actualizarModoControlesFranja('aleatorio');
    
    // Actualizar badge de modo
    this.actualizarModoBadges('Aleatorio');
    
    // Ocultar barra de progreso
    this.toggleDisplayForAll('[data-lab-passage-progress-container]', 'none');
    
    // Ocultar botón anterior
    this.getAllUIs().forEach((ui) => {
      if (ui.btnPrevPassage) {
        ui.btnPrevPassage.style.display = 'none';
      }
    });

    this.actualizarBotonesNavegacionPasajes();
    this.actualizarBotonNotasSheet();
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
    const progreso = this.modoNavegacion === 'secuencial' && this.pasajes.length > 0
      ? ((this.pasajeActualIndex + 1) / this.pasajes.length) * 100
      : 0;

    this.getAllUIs().forEach((ui) => {
      ui.root.querySelectorAll('[data-lab-passage-progress-fill]').forEach((barraFill) => {
        barraFill.style.width = `${progreso}%`;
      });
    });
  }

  /**
   * Actualizar barra de progreso de notas
   * Usa el estado interno (notas evaluadas / total) para el porcentaje
   */
  actualizarBarraProgresoNotas() {
    const total = Math.max(1, this.notasPasaje.length);
    const evaluadas = this.notasEvaluadas ? this.notasEvaluadas.size : 0;
    const porcentaje = (evaluadas / total) * 100;

    this.getAllUIs().forEach((ui) => {
      ui.root.querySelectorAll('[data-lab-note-progress-fill], [data-lab-note-progress-fill-collapsed]').forEach((barraFill) => {
        barraFill.style.width = `${porcentaje}%`;
      });
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
      console.log('Fin de pasajes alcanzado');
      this.mostrarFinalizacion();
      return;
    }

    this.pasajeActualIndex = index;
    
    // Marcar como visitado (para modo aleatorio)
    this.pasajesVisitados.add(index);
    
    // Reset estado de notas
    this.notasPasaje = [];
    this.notaActualIndex = -1;
    this.notasEvaluadas.clear();
    this.isNoteSheetOpen = false;

    const pasaje = this.pasajes[index];
    this.pasajeActual = pasaje;

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

    // Mostrar placeholder o primera nota
    if (this.notasPasaje.length === 0) {
      this.renderizarEstadoNotaPanel(
        'No hay notas en este pasaje',
        'Sin evaluaciones disponibles en este pasaje'
      );
    } else {
      this.renderizarEstadoNotaPanel(
        '',
        ''
      );
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
    this.notasEvaluadas.add(buildNoteEvaluationKey(notaId, noteChange));
    this.actualizarContadores();
    
    // Re-renderizar la nota actual para mostrar estado evaluado
    const nota = this.notasPasaje.find(n => n.nota_id === notaId);
    if (nota) {
      this.renderizarNotaActual(nota);
      this.actualizarBotonNotasSheet();
    }

    mostrarToast('Evaluación guardada', 2000);
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

    this.setTextForAll('[data-lab-notes-total]', total);
    this.setTextForAll('[data-lab-notes-evaluated]', evaluadas);
    this.setTextForAll('[data-lab-notes-passage-total]', total);
    this.setTextForAll('[data-lab-notes-total-resumen]', total);
    this.setTextForAll('[data-lab-notes-evaluated-resumen]', evaluadas);
    
    if (this.notaActualIndex >= 0) {
      this.setTextForAll('[data-lab-note-index]', this.notaActualIndex + 1);
    } else {
      this.setTextForAll('[data-lab-note-index]', 0);
    }

    // Actualizar barra de progreso de notas tras cambiar contadores
    this.actualizarBarraProgresoNotas();
    this.actualizarBotonNotasSheet();
  }

  /**
   * Actualizar estado de botones de navegacion
   */
  actualizarBotonesNavegacion() {
    const hasNotes = this.notasPasaje.length > 0;
    const canOpenFirst = this.notaActualIndex === -1 && hasNotes;

    this.getAllUIs().forEach((ui) => {
      if (ui.btnPrevNote) {
        ui.btnPrevNote.disabled = !hasNotes || this.notaActualIndex <= 0;
      }

      if (ui.btnNextNote) {
        ui.btnNextNote.disabled = !hasNotes || (!canOpenFirst && this.notaActualIndex >= this.notasPasaje.length - 1);
      }
    });
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

      ui.noteDragHandle?.addEventListener('pointerdown', (event) => {
        this.startMobileSheetDrag(event);
      });
    });

    // Botón cambiar modo
    document.querySelectorAll('[data-cambiar-modo]').forEach((button) => {
      button.addEventListener('click', async () => {
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

    // Revalidar overflow horizontal al cambiar tamano de viewport
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
    this.modoNavegacion = null;
    this.pasajesVisitados.clear();
    this.actualizarModoControlesFranja(null);
    this.closeNoteSheet();
    this.mostrarPantallaBienvenida();
  }

  actualizarModoControlesFranja(modo) {
    this.getAllUIs().forEach((ui) => {
      if (!ui.controlsShell) return;

      if (modo) {
        ui.controlsShell.setAttribute('data-modo', modo);
      } else {
        ui.controlsShell.removeAttribute('data-modo');
      }
    });
  }

  /**
   * Actualizar estado de botones de navegación de pasajes
   */
  actualizarBotonesNavegacionPasajes() {
    this.getAllUIs().forEach((ui) => {
      const btnAnterior = ui.btnPrevPassage;
      const btnSiguiente = ui.btnNextPassage;

      if (btnAnterior) {
        btnAnterior.style.display = this.modoNavegacion === 'secuencial' ? 'inline-flex' : 'none';
        btnAnterior.disabled = this.modoNavegacion !== 'secuencial' || this.pasajeActualIndex <= 0;
      }

      if (!btnSiguiente) return;

      if (this.modoNavegacion === 'secuencial') {
        btnSiguiente.disabled = this.pasajeActualIndex >= this.pasajes.length - 1;
        btnSiguiente.innerHTML = '<span>Siguiente</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
        btnSiguiente.setAttribute('aria-label', 'Siguiente pasaje');
      } else if (this.modoNavegacion === 'aleatorio') {
        btnSiguiente.disabled = false;
        btnSiguiente.innerHTML = '<i class="fa-solid fa-shuffle" aria-hidden="true"></i><span>Otro aleatorio</span>';
        btnSiguiente.setAttribute('aria-label', 'Otro pasaje aleatorio');
      } else {
        btnSiguiente.disabled = false;
        btnSiguiente.innerHTML = '<span>Siguiente</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
        btnSiguiente.setAttribute('aria-label', 'Siguiente pasaje');
      }
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
      <div style="text-align: center; padding: 80px 20px; max-width: 600px; margin: 0 auto;">
        <h1 style="font-size: 3rem; color: var(--success); margin-bottom: 20px;">Felicidades!</h1>
        <p style="font-size: 1.5rem; color: var(--text-muted); margin-bottom: 30px;">
          Has completado todos los pasajes disponibles
        </p>
        <p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 40px;">
          Gracias por tu contribucion al proyecto
        </p>
        <a href="../index.html" class="btn" style="font-size: 1.2rem; padding: 15px 40px;">
          Volver al inicio
        </a>
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


