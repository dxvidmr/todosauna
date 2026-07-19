import { renderNoteEvalLoading } from '../shared/note-panel.js';
import {
  buildNoteEvaluationKey,
  getCachedNoteRecord,
  normalizeEvalCounts,
  normalizeNoteChange,
  setCachedNoteEvaluationCounts
} from './notas.js';

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

function getResolvedNoteChange(noteData = {}, fallback = '') {
  return normalizeNoteChange(
    noteData?.nota_change ||
    noteData?.noteChange ||
    fallback
  );
}

function getCachedCounts(notaId, noteChange) {
  const cached = getCachedNoteRecord(notaId, noteChange);
  return normalizeEvalCounts(cached?.evaluaciones);
}

function obtenerEvaluacionesStats(notaId, noteData = null, noteChange = '') {
  const resolvedChange = getResolvedNoteChange(noteData, noteChange);
  if (noteData && noteData.evaluaciones) {
    return normalizeEvalCounts(noteData.evaluaciones);
  }
  return getCachedCounts(notaId, resolvedChange);
}

async function getNoteEvaluationMeta(notaId, noteData = null) {
  const resolvedChange = getResolvedNoteChange(noteData);
  const cachedCounts = getCachedCounts(notaId, resolvedChange);
  const counts = normalizeEvalCounts(noteData?.evaluaciones || cachedCounts);

  return {
    noteId: notaId,
    noteChange: resolvedChange,
    noteKey: buildNoteEvaluationKey(notaId, resolvedChange),
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
      const noteKey = buildNoteEvaluationKey(row?.nota_id, row?.nota_change);
      if (noteKey) ids.add(noteKey);
    });
  } catch (error) {
    console.warn('No se pudieron cargar notas evaluadas de la sesión:', error);
  }

  return ids;
}

function updateDockState(dockEl, state, noteId, noteChange = '') {
  if (!dockEl) return;
  dockEl.dataset.evalState = state;
  dockEl.dataset.evalNoteId = noteId || '';
  dockEl.dataset.evalNoteChange = normalizeNoteChange(noteChange);
}

function renderEvaluationState(dockEl, options = {}) {
  if (!dockEl) return null;

  const state = String(options.state || 'idle').trim() || 'idle';
  const noteId = String(options.noteId || '').trim();
  const noteChange = normalizeNoteChange(options.noteChange);
  const message = String(options.message || '').trim();

  updateDockState(dockEl, state, noteId, noteChange);

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

function crearBotonesConContadores(notaId, noteChange, evaluaciones) {
  const counts = normalizeEvalCounts(evaluaciones);
  const safeChange = normalizeNoteChange(noteChange);
  const badgeSinEvaluaciones = counts.total === 0
    ? '<span class="eval-badge-empty">Sin evaluaciones</span>'
    : '';

  return `
    <div class="evaluacion-header">
      <span>¿Te resulta útil esta nota?</span>
      ${badgeSinEvaluaciones}
    </div>
    <div class="evaluacion-botones">
      <button class="btn btn-outline-action btn-evaluar btn-util" data-nota-id="${notaId}" data-note-change="${safeChange}">
        <span class="btn-contador">${counts.utiles}</span>
        <i class="fa-solid fa-heart" aria-hidden="true"></i>
        Útil
      </button>
      <button class="btn btn-outline-action btn-evaluar btn-mejorable" data-nota-id="${notaId}" data-note-change="${safeChange}">
        <span class="btn-contador">${counts.mejorables}</span>
        <i class="fa-solid fa-heart-crack" aria-hidden="true"></i>
        Mejorable
      </button>
    </div>
    <div class="evaluacion-comentario" style="display:none;">
      <textarea placeholder="[opcional] ¿Qué cambiarías? Puedes explicar lo que no te gusta o redactar una nueva nota." rows="3"></textarea>
      <button class="btn btn-action btn-sm btn-enviar-comentario me-2"><i class="fa-solid fa-paper-plane me-2" aria-hidden="true"></i>Enviar</button>
      <button class="btn btn-outline-action btn-sm btn-cancelar-comentario">Cancelar</button>
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

function actualizarContadorLocal(notaId, noteChange, vote, options = {}) {
  const currentCounts = getCachedCounts(notaId, noteChange);
  const nextCounts = {
    total: currentCounts.total + 1,
    utiles: currentCounts.utiles + ((vote === 'up' || vote === 'util') ? 1 : 0),
    mejorables: currentCounts.mejorables + ((vote === 'down' || vote === 'mejorable') ? 1 : 0)
  };

  setCachedNoteEvaluationCounts(notaId, noteChange, nextCounts);

  const scopeRoot = options.scopeEl || null;
  const dock = getDockForScope(scopeRoot);
  const updateRoot = getEvaluationRoot(scopeRoot) || dock || scopeRoot;
  if (updateRoot) {
    updateCountersInScope(updateRoot, nextCounts);
  }

  return normalizeEvalCounts(nextCounts);
}

function setEvaluationBusy(noteKey, isBusy, scopeEl) {
  const key = String(noteKey || '');
  if (!key) return;

  const root = scopeEl || document;
  root.querySelectorAll('.nota-evaluacion').forEach((block) => {
    if (String(block.dataset.noteKey || '') !== key) return;
    block.querySelectorAll('button').forEach((btn) => { btn.disabled = !!isBusy; });
    block.querySelectorAll('textarea').forEach((area) => { area.readOnly = !!isBusy; });
  });
}

function mostrarEvaluadaFeedback(container, notaId, noteChange = '') {
  if (!container) return;

  const dock = getDockForScope(container);
  container.outerHTML = createEvaluatedMarkup();
  if (dock) {
    updateDockState(dock, 'evaluated', notaId, noteChange);
  }
}

function attachEvaluationListeners(
  container,
  notaId,
  noteChange,
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
  const noteKey = buildNoteEvaluationKey(notaId, noteChange);
  let isSubmitting = false;
  const btnEnviarDefaultHtml = btnEnviar ? btnEnviar.innerHTML : '';

  if (!btnUtil || !btnMejorable || !evaluacionRoot) {
    console.warn('Botones de evaluación no encontrados');
    return;
  }

  if (!evaluacionRoot.dataset.noteId) {
    evaluacionRoot.dataset.noteId = String(notaId || '');
  }
  evaluacionRoot.dataset.noteChange = normalizeNoteChange(noteChange);
  evaluacionRoot.dataset.noteKey = noteKey;

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
    if (dock) updateDockState(dock, 'commenting', notaId, noteChange);
    if (comentarioDiv) comentarioDiv.style.display = 'block';
    textarea?.focus();
  };

  const exitCommentMode = ({ clear = false } = {}) => {
    evaluacionRoot.classList.remove('is-commenting');
    if (dock && dock.dataset.evalState !== 'evaluated') {
      updateDockState(dock, 'ready', notaId, noteChange);
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
      exito = await registrarCallback(notaId, noteChange, 'up', null);
    } catch (error) {
      console.error('Error enviando evaluación útil:', error);
    } finally {
      if (!exito) setSubmittingState(false);
    }

    if (exito) {
      actualizarContadorLocal(notaId, noteChange, 'up', { scopeEl: evaluacionRoot });
      if (typeof feedbackCallback === 'function') {
        feedbackCallback(notaId, noteChange, 'up', {
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
      exito = await registrarCallback(notaId, noteChange, 'down', comentario || null);
    } catch (error) {
      console.error('Error enviando comentario de evaluación:', error);
    } finally {
      if (!exito) setSubmittingState(false);
    }

    if (exito) {
      actualizarContadorLocal(notaId, noteChange, 'down', { scopeEl: evaluacionRoot });
      if (typeof feedbackCallback === 'function') {
        feedbackCallback(notaId, noteChange, 'down', {
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
  const noteChange = normalizeNoteChange(opciones.noteChange);
  const lockKey = buildNoteEvaluationKey(notaId, noteChange) || String(notaId || '');
  if (lockKey && pendingEvaluaciones.has(lockKey)) return false;

  const source = opciones.source || 'lectura';
  const flow = window.Participacion?.flow;

  if (
    (source === 'lectura' || source === 'laboratorio') &&
    flow?.ensureModeForSecondLecturaContribution
  ) {
    const canContinue = await flow.ensureModeForSecondLecturaContribution();
    if (!canContinue) {
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast('Para continuar debes elegir modo de participación', 2600);
      }
      return false;
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
          'No se pudo preparar la sesión para enviar la evaluación'
        );
        window.mostrarToast(ensureMessage || 'No se pudo preparar la sesión', 3000);
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
      nota_change: noteChange,
      vote: opciones.vote,
      comment: opciones.comentario || null
    });

    if (result.error) {
      const message = getParticipationUserMessage(result.error, 'evaluacion', 'Error al enviar evaluación');
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast(message || 'Error al enviar evaluación', 3000);
      }
      return false;
    }

    if (
      (source === 'lectura' || source === 'laboratorio') &&
      flow?.incrementLecturaParticipationCount
    ) {
      flow.incrementLecturaParticipationCount({ source });
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

function getMissingChangeMessage(options = {}) {
  return options.missingChangeMessage || 'Esta nota aún no tiene un estado editorial evaluable.';
}

async function mountNoteEvaluationDock(options = {}) {
  const dockEl = options.dockEl;
  if (!dockEl) return null;

  const noteId = String(options.noteId || '').trim();
  if (!noteId) {
    renderEvaluationState(dockEl, {
      state: 'idle',
      noteId: '',
      noteChange: '',
      message: options.message || ''
    });
    return null;
  }

  const noteData = options.noteData || {};
  const requestedNoteChange = getResolvedNoteChange({
    ...noteData,
    nota_change: options.noteChange || noteData.nota_change || noteData.noteChange
  });
  const noteKey = buildNoteEvaluationKey(noteId, requestedNoteChange);

  if (options.alreadyEvaluated) {
    renderEvaluationState(dockEl, {
      state: 'evaluated',
      noteId,
      noteChange: requestedNoteChange
    });
    return {
      state: 'evaluated',
      noteId,
      noteChange: requestedNoteChange,
      noteKey
    };
  }

  renderEvaluationState(dockEl, {
    state: 'loading',
    noteId,
    noteChange: requestedNoteChange
  });

  const isStale = typeof options.isStale === 'function'
    ? options.isStale
    : () => false;

  const meta = await getNoteEvaluationMeta(noteId, {
    ...noteData,
    nota_change: requestedNoteChange,
    evaluaciones: options.counts || noteData.evaluaciones
  });

  if (!dockEl.isConnected || isStale()) return null;

  if (!meta.noteChange) {
    renderEvaluationState(dockEl, {
      state: 'error',
      noteId,
      noteChange: '',
      message: getMissingChangeMessage(options)
    });
    if (typeof options.onError === 'function') {
      options.onError({
        noteId,
        noteChange: '',
        noteKey: '',
        dockEl,
        reason: 'missing-change'
      });
    }
    return null;
  }

  const block = document.createElement('div');
  block.className = 'nota-evaluacion';
  block.dataset.noteId = noteId;
  block.dataset.noteChange = meta.noteChange;
  block.dataset.noteKey = meta.noteKey;
  block.innerHTML = crearBotonesConContadores(noteId, meta.noteChange, meta.counts);

  dockEl.innerHTML = '';
  updateDockState(dockEl, 'ready', noteId, meta.noteChange);
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
      noteChange: meta.noteChange,
      noteKey: meta.noteKey,
      counts: meta.counts,
      block
    };
  }

  attachEvaluationListeners(
    block,
    noteId,
    meta.noteChange,
    (currentNoteId, currentNoteChange, vote, comment) => submitNoteEvaluationShared({
      notaId: currentNoteId,
      noteChange: currentNoteChange,
      vote,
      comentario: comment || null,
      source: options.source || 'lectura',
      pasajeId: options.pasajeId || null,
      scopeEl: options.scopeEl || dockEl
    }),
    (currentNoteId, currentNoteChange, vote, context) => {
      if (typeof options.onSuccess === 'function') {
        options.onSuccess({
          noteId: currentNoteId,
          noteChange: currentNoteChange,
          noteKey: buildNoteEvaluationKey(currentNoteId, currentNoteChange),
          vote,
          counts: meta.counts,
          dockEl,
          container: context?.container || block
        });
        return;
      }

      mostrarEvaluadaFeedback(context?.container || block, currentNoteId, currentNoteChange);
    },
    {
      scopeEl: options.scopeEl || dockEl
    }
  );

  return {
    state: 'ready',
    noteId,
    noteChange: meta.noteChange,
    noteKey: meta.noteKey,
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
