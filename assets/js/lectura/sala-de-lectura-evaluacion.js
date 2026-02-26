// ============================================
// NOTE EVALUATION SYSTEM IN READING MODE
// ============================================

class EdicionEvaluacion {
  constructor() {
    this.notasEvaluadasLocal = new Set();
    this.notasEvaluadasBD = new Set();
    this.pendingEvaluaciones = new Set();
    this.evalRenderSeq = 0;
    this.versionCache = new Map();
    this.noteContentObserver = null;
  }

  setEvaluationBusy(notaId, isBusy) {
    var key = String(notaId || '');
    if (!key) return;

    document
      .querySelectorAll('.nota-evaluacion')
      .forEach((block) => {
        if (String(block.dataset.noteId || '') !== key) return;
        block.querySelectorAll('button').forEach((btn) => {
          btn.disabled = !!isBusy;
        });
        block.querySelectorAll('textarea').forEach((area) => {
          area.readOnly = !!isBusy;
        });
      });
  }

  /**
   * Initialize evaluation system.
   * Must run after notes and text are ready.
   */
  async init() {
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
      const datosUsuario = window.userManager?.obtenerDatosUsuario() || (() => {
        const sessionData = window.Participacion?.session?.getPublicSessionData?.();
        if (!sessionData?.session_id) return null;
        return { session_id: sessionData.session_id };
      })();
      if (!datosUsuario?.session_id) return;

      const { data, error } = await window.SupabaseAPI.getSessionEvaluatedNotes(datosUsuario.session_id);

      if (!error && data) {
        data.forEach((e) => this.notasEvaluadasBD.add(e.nota_id));
        console.log(`${this.notasEvaluadasBD.size} notas ya evaluadas cargadas`);
      }
    } catch (err) {
      console.warn('No se pudieron cargar evaluaciones previas:', err);
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
    dock.innerHTML = `
      <div class="lectura-note-eval-loading" data-eval-loading="true" aria-hidden="true">
        <span class="lectura-skeleton-line is-title"></span>
        <div class="lectura-skeleton-btnrow">
          <span class="lectura-skeleton-btn"></span>
          <span class="lectura-skeleton-btn"></span>
        </div>
      </div>
    `;
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
    dock.innerHTML = `<p class="lectura-note-dock-placeholder">${mensaje}</p>`;
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
    const dock = noteContentDiv.querySelector('.lectura-note-eval-dock') || noteContentDiv;
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

    const currentDock = noteContentDiv.querySelector('.lectura-note-eval-dock');
    if (!currentDock) return;

    if (!version) {
      this.renderDockError(currentDock, notaId, 'No se pudo cargar la evaluación.');
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
    } else {
      evaluacionDiv.innerHTML = `
        <div class="evaluacion-header">
          <span>¿Te resulta útil esta nota?</span>
        </div>
        <div class="evaluacion-botones">
          <button class="btn btn-outline-success btn-evaluar btn-util" data-nota-id="${notaId}" data-version="${version}">
            <i class="fa-solid fa-heart" aria-hidden="true"></i> Util
          </button>
          <button class="btn btn-outline-danger btn-evaluar btn-mejorable" data-nota-id="${notaId}" data-version="${version}">
            <i class="fa-solid fa-heart-crack" aria-hidden="true"></i> Mejorable
          </button>
        </div>
        <div class="evaluacion-comentario" style="display:none;">
          <textarea placeholder="¿Qué cambiarías? Puedes explicar lo que no te gusta o redactar una nueva nota (opcional)" rows="3"></textarea>
          <button class="btn btn-dark btn-sm btn-enviar-comentario me-2"><i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>Enviar</button>
          <button class="btn btn-outline-dark btn-sm btn-cancelar-comentario">Cancelar</button>
        </div>
      `;
    }

    currentDock.innerHTML = '';
    currentDock.dataset.evalState = 'ready';
    currentDock.dataset.evalNoteId = notaId;
    currentDock.appendChild(evaluacionDiv);

    if (typeof attachEvaluationListeners === 'function') {
      attachEvaluationListeners(
        evaluacionDiv,
        notaId,
        version,
        (nId, ver, vote, comment) => this.registrarEvaluacion(nId, ver, vote, comment),
        (nId, vote) => this.mostrarFeedback(evaluacionDiv, vote, nId)
      );
    } else {
      this.attachButtonListeners(evaluacionDiv, notaId, version);
    }
  }

  /**
   * Get note version from Supabase.
   */
  async obtenerVersionNota(notaId) {
    try {
      const { data, error } = await window.SupabaseAPI.getNotaVersion(notaId);

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
   * Legacy listener setup. Keep for fallback path.
   */
  attachButtonListeners(container, notaId, version) {
    const btnUtil = container.querySelector('.btn-util');
    const btnMejorable = container.querySelector('.btn-mejorable');
    const comentarioDiv = container.querySelector('.evaluacion-comentario');
    const textarea = comentarioDiv?.querySelector('textarea');
    const btnEnviar = comentarioDiv?.querySelector('.btn-enviar-comentario');
    const btnCancelar = comentarioDiv?.querySelector('.btn-cancelar-comentario');

    btnUtil?.addEventListener('click', async () => {
      const exito = await this.registrarEvaluacion(notaId, version, 'up', null);
      if (exito) {
        if (typeof actualizarContadorLocal === 'function') {
          actualizarContadorLocal(notaId, 'up');
        }
        this.mostrarFeedback(container, 'up', notaId);
      }
    });

    btnMejorable?.addEventListener('click', () => {
      if (!comentarioDiv) return;
      comentarioDiv.style.display = 'block';
      textarea?.focus();
    });

    btnEnviar?.addEventListener('click', async () => {
      const comentario = textarea?.value.trim() || null;
      const exito = await this.registrarEvaluacion(notaId, version, 'down', comentario);
      if (exito) {
        if (typeof actualizarContadorLocal === 'function') {
          actualizarContadorLocal(notaId, 'down');
        }
        this.mostrarFeedback(container, 'down', notaId);
      }
    });

    btnCancelar?.addEventListener('click', () => {
      if (!comentarioDiv) return;
      comentarioDiv.style.display = 'none';
      if (textarea) textarea.value = '';
    });
  }

  /**
   * Save vote in Supabase.
   */
  async registrarEvaluacion(notaId, version, vote, comentario) {
    const lockKey = String(notaId || '');
    if (lockKey && this.pendingEvaluaciones.has(lockKey)) {
      return false;
    }

    const flow = window.Participacion?.flow;
    if (flow?.ensureModeForSecondLecturaContribution) {
      const canContinue = await flow.ensureModeForSecondLecturaContribution();
      if (!canContinue) {
        mostrarToast('Para continuar debes elegir modo de participación', 2600);
        return false;
      }
    }

    const datosUsuario = window.userManager.obtenerDatosUsuario() || (() => {
      const sessionData = window.Participacion?.session?.getPublicSessionData?.();
      if (!sessionData?.session_id) return null;
      return { session_id: sessionData.session_id };
    })();

    if (!datosUsuario) {
      console.error('No se pudo obtener datos de usuario');
      mostrarToast('Error: modo no definido', 3000);
      return false;
    }

    if (lockKey) {
      this.pendingEvaluaciones.add(lockKey);
      this.setEvaluationBusy(lockKey, true);
    }

    try {
      const { error } = await window.SupabaseAPI.submitNoteEvaluation({
        source: 'lectura',
        session_id: datosUsuario.session_id,
        pasaje_id: null,
        nota_id: notaId,
        nota_version: version,
        vote: vote,
        comment: comentario
      });

      if (error) {
        console.error('Error al registrar evaluación:', error);
        const message = window.SupabaseAPI?.getParticipationUserMessage?.(
          error,
          'evaluacion',
          'Error al enviar evaluación'
        );
        mostrarToast(message || 'Error al enviar evaluación', 3000);
        return false;
      }

      if (flow?.incrementLecturaParticipationCount) {
        flow.incrementLecturaParticipationCount();
      }

      console.log('Evaluación registrada:', vote, notaId);
      return true;
    } finally {
      if (lockKey) {
        this.pendingEvaluaciones.delete(lockKey);
        this.setEvaluationBusy(lockKey, false);
      }
    }
  }

  /**
   * Show local visual feedback after voting.
   */
  mostrarFeedback(container, vote, notaId) {
    const botones = container.querySelector('.evaluacion-botones');
    const comentario = container.querySelector('.evaluacion-comentario');

    if (botones) botones.style.display = 'none';
    if (comentario) comentario.style.display = 'none';

    this.notasEvaluadasLocal.add(notaId);

    const feedback = document.createElement('div');
    feedback.className = 'nota-ya-evaluada';
    feedback.innerHTML = '<i class="fa-solid fa-check-circle" aria-hidden="true"></i> Nota evaluada';

    const dock = container.closest('.lectura-note-eval-dock');
    container.replaceWith(feedback);
    if (dock) {
      dock.dataset.evalState = 'evaluated';
      dock.dataset.evalNoteId = notaId;
    }

    mostrarToast(vote === 'up' ? 'Nota marcada como útil' : 'Gracias por tu feedback', 2000);
  }
}

window.edicionEvaluacion = new EdicionEvaluacion();

console.log('EdicionEvaluacion cargado');
