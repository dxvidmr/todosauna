import { renderNoteEvalLoading } from '../shared/note-panel.js';

const pendingEvaluaciones = new Set();

function getApiV2() {
  return window.Participacion?.apiV2 || null;
}

function getSessionData() {
  return window.Participacion?.session?.getPublicSessionData?.() || null;
}

function getParticipationUserMessage(error, context, fallback) {
  const api = getApiV2();
  if (api && typeof api.getParticipationUserMessage === 'function') {
    return api.getParticipationUserMessage(error, context, fallback);
  }
  if (typeof fallback === 'string' && fallback.trim()) return fallback;
  if (error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return 'Error inesperado';
}

function normalizeEvalCounts(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    total: Number(source.total || 0),
    utiles: Number(source.utiles || 0),
    mejorables: Number(source.mejorables || 0)
  };
}

function getCachedNoteRecord(notaId) {
  if (!notaId || !Array.isArray(window.notasActivasCache)) return null;
  return window.notasActivasCache.find((note) => note.nota_id === notaId) || null;
}

function getEvaluationRoot(container) {
  if (!container || typeof container.closest !== 'function') return null;
  return (
    container.closest('.nota-evaluacion') ||
    container.querySelector?.('.nota-evaluacion') ||
    container
  );
}

function getDockForScope(scopeEl) {
  if (!scopeEl) return null;
  if (scopeEl.classList?.contains('note-eval-dock')) return scopeEl;
  return scopeEl.querySelector?.('.note-eval-dock') || scopeEl.closest?.('.note-eval-dock') || null;
}

function createEvaluatedMarkup() {
  return '<div class="nota-ya-evaluada"><i class="fa-solid fa-check-circle" aria-hidden="true"></i> Nota evaluada</div>';
}

function obtenerEvaluacionesStats(notaId, notaData = null) {
  if (notaData && notaData.evaluaciones) {
    return normalizeEvalCounts(notaData.evaluaciones);
  }

  const notaEnCache = getCachedNoteRecord(notaId);
  if (notaEnCache && notaEnCache.evaluaciones) {
    return normalizeEvalCounts(notaEnCache.evaluaciones);
  }

  return normalizeEvalCounts();
}

async function getNoteEvaluationMeta(notaId, noteData = null) {
  const counts = normalizeEvalCounts(
    noteData?.evaluaciones || getCachedNoteRecord(notaId)?.evaluaciones
  );

  let version = String(
    noteData?.version ||
    getCachedNoteRecord(notaId)?.version ||
    ''
  ).trim();

  if (!version) {
    const apiV2 = getApiV2();
    if (apiV2 && typeof apiV2.getNotaVersion === 'function') {
      try {
        const { data, error } = await apiV2.getNotaVersion(notaId);
        if (!error && data?.version) {
          version = String(data.version).trim();
        }
      } catch (error) {
        console.warn('No se pudo obtener la version de la nota:', notaId, error);
      }
    }
  }

  return {
    noteId: notaId,
    version,
    counts
  };
}

async function loadSessionEvaluatedNoteIds(sessionId) {
  const ids = new Set();
  const apiV2 = getApiV2();
  const safeSessionId = String(sessionId || '').trim();

  if (!apiV2 || typeof apiV2.getSessionEvaluatedNotes !== 'function' || !safeSessionId) {
    return ids;
  }

  try {
    const { data, error } = await apiV2.getSessionEvaluatedNotes(safeSessionId);
    if (error || !Array.isArray(data)) return ids;
    data.forEach((row) => {
      const noteId = String(row?.nota_id || '').trim();
      if (noteId) ids.add(noteId);
    });
  } catch (error) {
    console.warn('No se pudieron cargar notas evaluadas de la sesion:', error);
  }

  return ids;
}

function updateDockState(dockEl, state, noteId) {
  if (!dockEl) return;
  dockEl.dataset.evalState = state;
  dockEl.dataset.evalNoteId = noteId || '';
}

function renderEvaluationState(dockEl, options = {}) {
  if (!dockEl) return null;

  const state = String(options.state || 'idle').trim() || 'idle';
  const noteId = String(options.noteId || '').trim();
  const message = String(options.message || '').trim();

  updateDockState(dockEl, state, noteId);

  if (state === 'loading') {
    dockEl.innerHTML = renderNoteEvalLoading();
    return dockEl;
  }

  if (state === 'evaluated') {
    dockEl.innerHTML = createEvaluatedMarkup();
    return dockEl;
  }

  if (state === 'error') {
    dockEl.innerHTML = `<p class="note-dock-placeholder">${message}</p>`;
    return dockEl;
  }

  if (state === 'idle') {
    dockEl.innerHTML = message
      ? `<p class="note-dock-placeholder">${message}</p>`
      : '<p class="note-dock-placeholder"></p>';
    return dockEl;
  }

  return dockEl;
}

function crearBotonesConContadores(notaId, version, evaluaciones) {
  const counts = normalizeEvalCounts(evaluaciones);
  const badgeSinEvaluaciones = counts.total === 0
    ? '<span class="eval-badge-empty">Sin evaluaciones</span>'
    : '';

  return `
    <div class="evaluacion-header">
      <span>¿Te resulta útil esta nota?</span>
      ${badgeSinEvaluaciones}
    </div>
    <div class="evaluacion-botones">
      <button class="btn btn-outline-dark btn-evaluar btn-util" data-nota-id="${notaId}" data-version="${version}">
        <span class="btn-contador">${counts.utiles}</span>
        <i class="fa-solid fa-heart" aria-hidden="true"></i>
        Útil
      </button>
      <button class="btn btn-outline-dark btn-evaluar btn-mejorable" data-nota-id="${notaId}" data-version="${version}">
        <span class="btn-contador">${counts.mejorables}</span>
        <i class="fa-solid fa-heart-crack" aria-hidden="true"></i>
        Mejorable
      </button>
    </div>
    <div class="evaluacion-comentario" style="display:none;">
      <textarea placeholder="[opcional] ¿Qué cambiarías? Puedes explicar lo que no te gusta o redactar una nueva nota." rows="3"></textarea>
      <button class="btn btn-dark btn-sm btn-enviar-comentario me-2"><i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>Enviar</button>
      <button class="btn btn-outline-dark btn-sm btn-cancelar-comentario">Cancelar</button>
    </div>
  `;
}

function updateCountersInScope(scopeEl, evaluaciones) {
  if (!scopeEl) return;

  const btnUtil = scopeEl.querySelector('.btn-util .btn-contador');
  if (btnUtil) {
    btnUtil.textContent = String(evaluaciones.utiles);
  }

  const btnMejorable = scopeEl.querySelector('.btn-mejorable .btn-contador');
  if (btnMejorable) {
    btnMejorable.textContent = String(evaluaciones.mejorables);
  }

  const badgeSinEvaluaciones = scopeEl.querySelector('.eval-badge-empty');
  if (badgeSinEvaluaciones && evaluaciones.total > 0) {
    badgeSinEvaluaciones.remove();
  }
}

function actualizarContadorLocal(notaId, vote, options = {}) {
  if (!Array.isArray(window.notasActivasCache)) {
    window.notasActivasCache = [];
  }

  let nota = window.notasActivasCache.find((entry) => entry.nota_id === notaId);
  if (!nota) {
    nota = {
      nota_id: notaId,
      evaluaciones: normalizeEvalCounts()
    };
    window.notasActivasCache.push(nota);
  }

  nota.evaluaciones = normalizeEvalCounts(nota.evaluaciones);
  nota.evaluaciones.total += 1;
  if (vote === 'up' || vote === 'util') {
    nota.evaluaciones.utiles += 1;
  } else if (vote === 'down' || vote === 'mejorable') {
    nota.evaluaciones.mejorables += 1;
  }

  const scopeRoot = options.scopeEl || null;
  const dock = getDockForScope(scopeRoot);
  const updateRoot = getEvaluationRoot(scopeRoot) || dock || scopeRoot;
  if (updateRoot) {
    updateCountersInScope(updateRoot, nota.evaluaciones);
  }

  return normalizeEvalCounts(nota.evaluaciones);
}

function setEvaluationBusy(notaId, isBusy, scopeEl) {
  const key = String(notaId || '');
  if (!key) return;

  const root = scopeEl || document;
  root.querySelectorAll('.nota-evaluacion').forEach((block) => {
    if (String(block.dataset.noteId || '') !== key) return;
    block.querySelectorAll('button').forEach((btn) => { btn.disabled = !!isBusy; });
    block.querySelectorAll('textarea').forEach((area) => { area.readOnly = !!isBusy; });
  });
}

function mostrarEvaluadaFeedback(container, notaId) {
  if (!container) return;

  const dock = getDockForScope(container);
  container.outerHTML = createEvaluatedMarkup();
  if (dock) {
    updateDockState(dock, 'evaluated', notaId);
  }
}

function attachEvaluationListeners(
  container,
  notaId,
  version,
  registrarCallback,
  feedbackCallback,
  options = {}
) {
  const btnUtil = container?.querySelector('.btn-util');
  const btnMejorable = container?.querySelector('.btn-mejorable');
  const comentarioDiv = container?.querySelector('.evaluacion-comentario, .nota-comentario');
  const textarea = comentarioDiv?.querySelector('textarea');
  const btnEnviar = comentarioDiv?.querySelector('.btn-enviar-comentario');
  const btnCancelar = comentarioDiv?.querySelector('.btn-cancelar-comentario');
  const evaluacionRoot =
    comentarioDiv?.closest('.nota-evaluacion') ||
    container?.closest?.('.nota-evaluacion') ||
    container;
  const scopeEl = options.scopeEl || getDockForScope(container) || container;
  const dock = getDockForScope(evaluacionRoot || scopeEl);
  let isSubmitting = false;
  const btnEnviarDefaultHtml = btnEnviar ? btnEnviar.innerHTML : '';

  if (!btnUtil || !btnMejorable || !evaluacionRoot) {
    console.warn('Botones de evaluacion no encontrados');
    return;
  }

  if (!evaluacionRoot.dataset.noteId) {
    evaluacionRoot.dataset.noteId = String(notaId || '');
  }

  const setSubmittingState = (value) => {
    isSubmitting = !!value;

    const controls = evaluacionRoot.querySelectorAll('button, textarea');
    controls.forEach((control) => {
      if (control.classList?.contains('btn-cancelar-comentario') && isSubmitting) {
        control.disabled = true;
        return;
      }

      if (control.tagName === 'TEXTAREA') {
        control.readOnly = isSubmitting;
      } else {
        control.disabled = isSubmitting;
      }
    });

    if (btnEnviar) {
      btnEnviar.innerHTML = isSubmitting
        ? '<i class="fa-solid fa-spinner fa-spin me-2" aria-hidden="true"></i>Enviando...'
        : btnEnviarDefaultHtml;
    }
  };

  const enterCommentMode = () => {
    evaluacionRoot.classList.add('is-commenting');
    if (dock) updateDockState(dock, 'commenting', notaId);
    if (comentarioDiv) comentarioDiv.style.display = 'block';
    textarea?.focus();
  };

  const exitCommentMode = ({ clear = false } = {}) => {
    evaluacionRoot.classList.remove('is-commenting');
    if (dock && dock.dataset.evalState !== 'evaluated') {
      updateDockState(dock, 'ready', notaId);
    }
    if (comentarioDiv) {
      comentarioDiv.style.display = 'none';
      if (clear && textarea) {
        textarea.value = '';
      }
    }
  };

  btnUtil.addEventListener('click', async () => {
    if (isSubmitting) return;
    exitCommentMode({ clear: false });
    setSubmittingState(true);

    let exito = false;
    try {
      exito = await registrarCallback(notaId, version, 'up', null);
    } catch (error) {
      console.error('Error enviando evaluacion util:', error);
    } finally {
      if (!exito) setSubmittingState(false);
    }

    if (exito) {
      actualizarContadorLocal(notaId, 'up', { scopeEl: evaluacionRoot });
      if (typeof feedbackCallback === 'function') {
        feedbackCallback(notaId, 'up', {
          container: evaluacionRoot,
          dockEl: dock,
          scopeEl
        });
      }
    }
  });

  btnMejorable.addEventListener('click', () => {
    if (isSubmitting) return;
    enterCommentMode();
  });

  btnCancelar?.addEventListener('click', () => {
    if (isSubmitting) return;
    exitCommentMode({ clear: true });
  });

  btnEnviar?.addEventListener('click', async () => {
    if (isSubmitting) return;
    const comentario = textarea?.value?.trim();

    setSubmittingState(true);

    let exito = false;
    try {
      exito = await registrarCallback(notaId, version, 'down', comentario);
    } catch (error) {
      console.error('Error enviando comentario de evaluacion:', error);
    } finally {
      if (!exito) setSubmittingState(false);
    }

    if (exito) {
      actualizarContadorLocal(notaId, 'down', { scopeEl: evaluacionRoot });
      if (typeof feedbackCallback === 'function') {
        feedbackCallback(notaId, 'down', {
          container: evaluacionRoot,
          dockEl: dock,
          scopeEl
        });
      }
    }
  });
}

async function submitNoteEvaluationShared(opciones) {
  const notaId = opciones.notaId;
  const lockKey = String(notaId || '');
  if (lockKey && pendingEvaluaciones.has(lockKey)) return false;

  const source = opciones.source || 'lectura';
  const flow = window.Participacion?.flow;

  if (source === 'lectura' && flow?.ensureModeForSecondLecturaContribution) {
    const canContinue = await flow.ensureModeForSecondLecturaContribution();
    if (!canContinue) {
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast('Para continuar debes elegir modo de participacion', 2600);
      }
      return false;
    }
  } else if (source === 'laboratorio') {
    const session = window.Participacion?.session;
    if (!session?.isModeDefined?.() && window.Participacion?.modal?.open) {
      await window.Participacion.modal.open({
        context: 'laboratorio-before-mode',
        reason: 'during-evaluation'
      });
    }
  }

  const apiV2 = getApiV2();
  const sessionManager = window.Participacion?.session || null;
  if (sessionManager && typeof sessionManager.ensureSessionForWrite === 'function') {
    const ensured = await sessionManager.ensureSessionForWrite();
    if (!ensured || !ensured.ok) {
      if (typeof window.mostrarToast === 'function') {
        const ensureMessage = getParticipationUserMessage(
          ensured && ensured.error,
          'session_bootstrap',
          'No se pudo preparar la sesion para enviar la evaluacion'
        );
        window.mostrarToast(ensureMessage || 'No se pudo preparar la sesion', 3000);
      }
      return false;
    }
  }

  const sessionData = getSessionData();
  if (!apiV2 || !sessionData?.session_id) {
    if (typeof window.mostrarToast === 'function') {
      window.mostrarToast('Error: modo no definido', 3000);
    }
    return false;
  }

  if (lockKey) {
    pendingEvaluaciones.add(lockKey);
    setEvaluationBusy(lockKey, true, opciones.scopeEl || null);
  }

  try {
    const result = await apiV2.submitNoteEvaluation({
      source,
      session_id: sessionData.session_id,
      pasaje_id: opciones.pasajeId || null,
      nota_id: notaId,
      nota_version: opciones.version,
      vote: opciones.vote,
      comment: opciones.comentario || null
    });

    if (result.error) {
      const message = getParticipationUserMessage(result.error, 'evaluacion', 'Error al enviar evaluacion');
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast(message || 'Error al enviar evaluacion', 3000);
      }
      return false;
    }

    if (source === 'lectura' && flow?.incrementLecturaParticipationCount) {
      flow.incrementLecturaParticipationCount({ source: 'lectura' });
    }

    return true;
  } finally {
    if (lockKey) {
      pendingEvaluaciones.delete(lockKey);
      setEvaluationBusy(lockKey, false, opciones.scopeEl || null);
    }
  }
}

function disableEvaluationControls(block) {
  if (!block) return;
  block.classList.add('is-readonly');
  block.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
  });
  block.querySelectorAll('textarea').forEach((textarea) => {
    textarea.disabled = true;
    textarea.readOnly = true;
  });
  const commentBox = block.querySelector('.evaluacion-comentario');
  if (commentBox) {
    commentBox.style.display = 'none';
  }
}

async function mountNoteEvaluationDock(options = {}) {
  const dockEl = options.dockEl;
  if (!dockEl) return null;

  const noteId = String(options.noteId || '').trim();
  if (!noteId) {
    renderEvaluationState(dockEl, {
      state: 'idle',
      noteId: '',
      message: options.message || ''
    });
    return null;
  }

  if (options.alreadyEvaluated) {
    renderEvaluationState(dockEl, {
      state: 'evaluated',
      noteId
    });
    return {
      state: 'evaluated',
      noteId
    };
  }

  renderEvaluationState(dockEl, {
    state: 'loading',
    noteId
  });

  const isStale = typeof options.isStale === 'function'
    ? options.isStale
    : () => false;

  const noteData = options.noteData || {};
  const meta = await getNoteEvaluationMeta(noteId, {
    ...noteData,
    version: options.version || noteData.version,
    evaluaciones: options.counts || noteData.evaluaciones
  });

  if (!dockEl.isConnected || isStale()) return null;

  if (!meta.version) {
    renderEvaluationState(dockEl, {
      state: 'error',
      noteId,
      message: options.message || 'No se pudo cargar la evaluacion. Vuelve a intentarlo mas tarde.'
    });
    if (typeof options.onError === 'function') {
      options.onError({
        noteId,
        dockEl,
        reason: 'missing-version'
      });
    }
    return null;
  }

  const block = document.createElement('div');
  block.className = 'nota-evaluacion';
  block.dataset.noteId = noteId;
  block.innerHTML = crearBotonesConContadores(noteId, meta.version, meta.counts);

  dockEl.innerHTML = '';
  updateDockState(dockEl, 'ready', noteId);
  dockEl.appendChild(block);

  if (options.mode === 'readonly') {
    disableEvaluationControls(block);
    if (options.readonlyMessage) {
      const readonlyMessage = document.createElement('p');
      readonlyMessage.className = 'home-eval-readonly';
      readonlyMessage.textContent = String(options.readonlyMessage);
      dockEl.appendChild(readonlyMessage);
    }
    return {
      state: 'readonly',
      noteId,
      version: meta.version,
      counts: meta.counts,
      block
    };
  }

  attachEvaluationListeners(
    block,
    noteId,
    meta.version,
    (currentNoteId, version, vote, comment) => submitNoteEvaluationShared({
      notaId: currentNoteId,
      version,
      vote,
      comentario: comment || null,
      source: options.source || 'lectura',
      pasajeId: options.pasajeId || null,
      scopeEl: options.scopeEl || dockEl
    }),
    (currentNoteId, vote, context) => {
      if (typeof options.onSuccess === 'function') {
        options.onSuccess({
          noteId: currentNoteId,
          version: meta.version,
          vote,
          counts: meta.counts,
          dockEl,
          container: context?.container || block
        });
        return;
      }

      mostrarEvaluadaFeedback(context?.container || block, currentNoteId);
    },
    {
      scopeEl: options.scopeEl || dockEl
    }
  );

  return {
    state: 'ready',
    noteId,
    version: meta.version,
    counts: meta.counts,
    block
  };
}

export {
  attachEvaluationListeners,
  crearBotonesConContadores,
  getApiV2,
  getNoteEvaluationMeta,
  getParticipationUserMessage,
  getSessionData,
  loadSessionEvaluatedNoteIds,
  mostrarEvaluadaFeedback,
  mountNoteEvaluationDock,
  obtenerEvaluacionesStats,
  renderEvaluationState,
  setEvaluationBusy,
  submitNoteEvaluationShared,
  actualizarContadorLocal
};
