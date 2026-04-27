import { mostrarToast } from '../lectura/utils.js';
import {
  getSessionData,
  loadSessionEvaluatedNoteIds,
  mountNoteEvaluationDock,
  renderEvaluationState,
  mostrarEvaluadaFeedback
} from './note-evaluation-runtime.js';

class EdicionEvaluacion {
  constructor() {
    this.notasEvaluadasLocal = new Set();
    this.notasEvaluadasBD = new Set();
    this.evalRenderSeq = 0;
    this.stateListenerAttached = false;
    this.handleSessionStateChanged = this.handleSessionStateChanged.bind(this);
  }

  async init() {
    this.attachStateChangeListener();
    await this.cargarNotasYaEvaluadas();
    await this.addEvaluationButtons();
  }

  getNoteContentDiv(noteContentDiv) {
    return noteContentDiv || document.getElementById('noteContent');
  }

  async cargarNotasYaEvaluadas() {
    const sessionData = getSessionData();
    this.notasEvaluadasBD = await loadSessionEvaluatedNoteIds(sessionData?.session_id);
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

    const noteContentDiv = this.getNoteContentDiv();
    const dock = noteContentDiv?.querySelector('.note-eval-dock') || noteContentDiv;
    if (dock) {
      renderEvaluationState(dock, {
        state: 'idle',
        noteId: '',
        message: ''
      });
    }

    try {
      await this.cargarNotasYaEvaluadas();
      await this.addEvaluationButtons(noteContentDiv);
    } catch (error) {
      console.warn('No se pudo refrescar la evaluacion tras rotar sesion:', error);
    }
  }

  estaEvaluada(notaId) {
    return this.notasEvaluadasLocal.has(notaId) || this.notasEvaluadasBD.has(notaId);
  }

  isRenderStale(noteContentDiv, notaId, renderSeq) {
    if (!noteContentDiv) return true;
    if (renderSeq !== this.evalRenderSeq) return true;
    if ((noteContentDiv.dataset.currentNoteId || '') !== notaId) return true;
    const currentDisplayId = noteContentDiv.querySelector('.note-display')?.dataset?.noteId || '';
    return currentDisplayId !== notaId;
  }

  async addEvaluationButtons(noteContentDiv) {
    const host = this.getNoteContentDiv(noteContentDiv);
    if (!host) return;

    const noteDisplay = host.querySelector('.note-display');
    const notaId = noteDisplay?.dataset?.noteId || null;
    const dock = host.querySelector('.note-eval-dock') || host;
    if (!dock) return;

    if (!notaId) {
      renderEvaluationState(dock, {
        state: 'idle',
        noteId: '',
        message: ''
      });
      return;
    }

    host.dataset.currentNoteId = notaId;
    const renderSeq = ++this.evalRenderSeq;

    if (this.estaEvaluada(notaId)) {
      renderEvaluationState(dock, {
        state: 'evaluated',
        noteId: notaId
      });
      return;
    }

    await mountNoteEvaluationDock({
      dockEl: dock,
      noteId: notaId,
      source: 'lectura',
      scopeEl: host,
      alreadyEvaluated: false,
      isStale: () => this.isRenderStale(host, notaId, renderSeq),
      onSuccess: ({ noteId: currentNoteId, vote, container }) => {
        this.mostrarFeedback(container, vote, currentNoteId);
      },
      onError: () => {
        if (this.isRenderStale(host, notaId, renderSeq)) return;
        renderEvaluationState(dock, {
          state: 'error',
          noteId: notaId,
          message: 'No se pudo cargar la evaluacion. Vuelve a intentarlo en otro momento.'
        });
      }
    });
  }

  mostrarFeedback(container, vote, notaId) {
    this.notasEvaluadasLocal.add(notaId);
    mostrarEvaluadaFeedback(container, notaId);
    mostrarToast(vote === 'up' ? 'Nota marcada como util' : 'Gracias por tu feedback', 2000);
  }
}

const edicionEvaluacion = new EdicionEvaluacion();

export {
  EdicionEvaluacion,
  edicionEvaluacion
};
