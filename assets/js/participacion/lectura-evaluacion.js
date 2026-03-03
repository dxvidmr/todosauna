// ============================================
// NOTE EVALUATION SYSTEM IN READING MODE
// ============================================
import { mostrarToast } from '../lectura/utils.js';
import { buildSkeletonLoadingHTML } from '../lectura/notas-dom.js';
import {
  obtenerEvaluacionesStats,
  crearBotonesConContadores,
  attachEvaluationListeners,
  actualizarContadorLocal,
  registrarEvaluacion as registrarEvaluacionShared,
  mostrarEvaluadaFeedback,
  getApiV2,
  getSessionData
} from './evaluaciones.js';

class EdicionEvaluacion {
  constructor() {
    this.notasEvaluadasLocal = new Set();
    this.notasEvaluadasBD = new Set();
    this.evalRenderSeq = 0;
    this.versionCache = new Map();
    this.noteContentObserver = null;
    this.stateListenerAttached = false;
    this.handleSessionStateChanged = this.handleSessionStateChanged.bind(this);
  }

  /**
   * Initialize evaluation system.
   * Must run after notes and text are ready.
   */
  async init() {
    this.attachStateChangeListener();
    console.log('Inicializando sistema de evaluación en edición...');

    await this.cargarNotasYaEvaluadas();

    const checkNotas = setInterval(() => {
      const noteContentDiv = document.getElementById('noteContent');
      if (noteContentDiv) {
        this.setupEvaluationListeners();
        clearInterval(checkNotas);
      }
    }, 100);
  }

  /**
   * Load notes already evaluated by this session/user.
   */
  async cargarNotasYaEvaluadas() {
    try {
      const apiV2 = getApiV2();
      const sessionData = getSessionData();
      this.notasEvaluadasBD.clear();
      if (!apiV2 || !sessionData?.session_id) return;

      const { data, error } = await apiV2.getSessionEvaluatedNotes(sessionData.session_id);

      if (!error && data) {
        data.forEach((e) => this.notasEvaluadasBD.add(e.nota_id));
        console.log(`${this.notasEvaluadasBD.size} notas ya evaluadas cargadas`);
      }
    } catch (err) {
      console.warn('No se pudieron cargar evaluaciones previas:', err);
    }
  }

  attachStateChangeListener() {
    if (this.stateListenerAttached || typeof window === 'undefined') return;
    window.addEventListener('participacion:state-changed', (event) => {
      void this.handleSessionStateChanged(event);
    });
    this.stateListenerAttached = true;
  }

  async handleSessionStateChanged(event) {
    const detail = event?.detail;
    if (!detail?.sessionChanged) return;

    this.notasEvaluadasLocal.clear();
    this.notasEvaluadasBD.clear();

    const noteContentDiv = document.getElementById('noteContent');
    const dock = noteContentDiv?.querySelector('.note-eval-dock') || noteContentDiv;
    if (dock) {
      dock.dataset.evalState = 'idle';
      dock.dataset.evalNoteId = '';
    }

    try {
      await this.cargarNotasYaEvaluadas();
      await this.addEvaluationButtons();
    } catch (error) {
      console.warn('No se pudo refrescar evaluaciones tras rotar sesion:', error);
    }
  }

  /**
   * Returns true if note is already evaluated in this session.
   */
  estaEvaluada(notaId) {
    return this.notasEvaluadasLocal.has(notaId) || this.notasEvaluadasBD.has(notaId);
  }

  /**
   * Observe note panel replacements and trigger evaluation dock render.
   */
  setupEvaluationListeners() {
    const noteContentDiv = document.getElementById('noteContent');
    if (!noteContentDiv) return;

    if (this.noteContentObserver) {
      this.noteContentObserver.disconnect();
    }

    // Only observe direct children changes of #noteContent.
    // This avoids excessive triggers when editing inner nodes inside the dock.
    this.noteContentObserver = new MutationObserver(() => {
      this.addEvaluationButtons();
    });

    this.noteContentObserver.observe(noteContentDiv, {
      childList: true,
      subtree: false
    });

    // Render once for the current note content.
    this.addEvaluationButtons();

    console.log('Listeners de evaluación configurados');
  }

  renderDockLoading(dock, notaId) {
    if (!dock) return;
    dock.dataset.evalState = 'loading';
    dock.dataset.evalNoteId = notaId;
    dock.innerHTML = buildSkeletonLoadingHTML();
  }

  renderDockEvaluada(dock, notaId) {
    if (!dock) return;
    dock.dataset.evalState = 'evaluated';
    dock.dataset.evalNoteId = notaId;
    dock.innerHTML = '<div class="nota-ya-evaluada"><i class="fa-solid fa-check-circle" aria-hidden="true"></i> Nota evaluada</div>';
  }

  renderDockError(dock, notaId, mensaje) {
    if (!dock) return;
    dock.dataset.evalState = 'error';
    dock.dataset.evalNoteId = notaId;
    dock.innerHTML = `<p class="note-dock-placeholder">${mensaje}</p>`;
  }

  isRenderStale(noteContentDiv, notaId, renderSeq) {
    if (!noteContentDiv) return true;
    if (renderSeq !== this.evalRenderSeq) return true;
    if ((noteContentDiv.dataset.currentNoteId || '') !== notaId) return true;
    const currentDisplayId = noteContentDiv.querySelector('.note-display')?.dataset?.noteId || '';
    return currentDisplayId !== notaId;
  }

  getVersionFromCache(notaId) {
    if (!notaId) return null;

    if (this.versionCache.has(notaId)) {
      return this.versionCache.get(notaId);
    }

    if (Array.isArray(window.notasActivasCache)) {
      const notaEnCache = window.notasActivasCache.find((n) => n.nota_id === notaId);
      const versionEnCache = notaEnCache?.version || null;
      if (versionEnCache) {
        this.versionCache.set(notaId, versionEnCache);
        return versionEnCache;
      }
    }

    return null;
  }

  async obtenerVersionNotaConCache(notaId) {
    const versionCache = this.getVersionFromCache(notaId);
    if (versionCache) return versionCache;

    const version = await this.obtenerVersionNota(notaId);
    if (version) {
      this.versionCache.set(notaId, version);
    }

    return version;
  }

  /**
   * Render evaluation block into the fixed dock.
   */
  async addEvaluationButtons() {
    const noteContentDiv = document.getElementById('noteContent');
    if (!noteContentDiv) return;

    const noteDisplay = noteContentDiv.querySelector('.note-display');
    const notaId = noteDisplay?.dataset?.noteId || null;
    const dock = noteContentDiv.querySelector('.note-eval-dock') || noteContentDiv;
    if (!dock) return;

    if (!notaId) {
      dock.dataset.evalState = 'idle';
      dock.dataset.evalNoteId = '';
      return;
    }

    if (!noteContentDiv.dataset.currentNoteId) {
      noteContentDiv.dataset.currentNoteId = notaId;
    }

    if (
      dock.dataset.evalNoteId === notaId &&
      (dock.dataset.evalState === 'ready' || dock.dataset.evalState === 'evaluated')
    ) {
      return;
    }

    this.renderDockLoading(dock, notaId);
    const renderSeq = ++this.evalRenderSeq;

    if (this.estaEvaluada(notaId)) {
      if (this.isRenderStale(noteContentDiv, notaId, renderSeq)) return;
      this.renderDockEvaluada(dock, notaId);
      return;
    }

    const version = await this.obtenerVersionNotaConCache(notaId);
    if (this.isRenderStale(noteContentDiv, notaId, renderSeq)) return;

    const currentDock = noteContentDiv.querySelector('.note-eval-dock');
    if (!currentDock) return;

    if (!version) {
      this.renderDockError(currentDock, notaId, 'No se pudo cargar la evaluación. Vuelva a intentarlo en otro momento.');
      return;
    }

    const evaluaciones = typeof obtenerEvaluacionesStats === 'function'
      ? obtenerEvaluacionesStats(notaId)
      : { total: 0, utiles: 0, mejorables: 0 };

    const evaluacionDiv = document.createElement('div');
    evaluacionDiv.className = 'nota-evaluacion';
    evaluacionDiv.dataset.noteId = notaId;

    if (typeof crearBotonesConContadores === 'function') {
      evaluacionDiv.innerHTML = crearBotonesConContadores(notaId, version, evaluaciones);
    }

    currentDock.innerHTML = '';
    currentDock.dataset.evalState = 'ready';
    currentDock.dataset.evalNoteId = notaId;
    currentDock.appendChild(evaluacionDiv);

    attachEvaluationListeners(
      evaluacionDiv,
      notaId,
      version,
      (nId, ver, vote, comment) => this.registrarEvaluacion(nId, ver, vote, comment),
      (nId, vote) => this.mostrarFeedback(evaluacionDiv, vote, nId)
    );
  }

  /**
   * Get note version from Supabase.
   */
  async obtenerVersionNota(notaId) {
    try {
      const apiV2 = getApiV2();
      if (!apiV2 || typeof apiV2.getNotaVersion !== 'function') {
        return null;
      }
      const { data, error } = await apiV2.getNotaVersion(notaId);

      if (error) {
        console.warn(`Nota ${notaId} no encontrada en Supabase`);
        return null;
      }

      return data.version;
    } catch (err) {
      console.error('Error al obtener version de nota:', err);
      return null;
    }
  }

  /**
   * Save vote in Supabase (delegates to shared function).
   */
  async registrarEvaluacion(notaId, version, vote, comentario) {
    return registrarEvaluacionShared({
      notaId, version, vote, comentario,
      source: 'lectura'
    });
  }

  /**
   * Show local visual feedback after voting.
   */
  mostrarFeedback(container, vote, notaId) {
    this.notasEvaluadasLocal.add(notaId);
    mostrarEvaluadaFeedback(container, notaId);
    mostrarToast(vote === 'up' ? 'Nota marcada como útil' : 'Gracias por tu feedback', 2000);
  }
}

window.edicionEvaluacion = new EdicionEvaluacion();

console.log('EdicionEvaluacion cargado');
