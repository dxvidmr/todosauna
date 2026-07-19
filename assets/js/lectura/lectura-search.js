import {
  SOURCE_TYPE_LABELS,
  buildIndex,
  groupResultsBySourceType,
  searchIndex
} from '../search/lunr-core.js';
import { buildLecturaSearchDocsFromSources } from '../search/lectura-search-docs.js';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeWhitespace(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

export function createLecturaSearchController({
  form,
  input,
  clearButton,
  status,
  results,
  textRoot,
  getNotesRoot,
  getNavigableNoteIds,
  onOpenNote
}) {
  let indexState = null;
  let pendingTarget = parsePendingTarget();

  function setStatus(message) {
    if (status) status.textContent = message || '';
  }

  function syncClearButton() {
    if (!(input instanceof HTMLInputElement) || !(clearButton instanceof HTMLButtonElement)) return;
    const hasValue = !!normalizeWhitespace(input.value);
    clearButton.hidden = !hasValue;
    clearButton.setAttribute('aria-hidden', hasValue ? 'false' : 'true');
  }

  function parsePendingTarget() {
    const params = new URLSearchParams(window.location.search || '');
    const rawTarget = String(params.get('ta_target') || '').trim();
    if (!rawTarget) return null;

    const [rawType, ...restParts] = rawTarget.split(':');
    const targetType = String(rawType || '').trim().toLowerCase();
    const targetId = restParts.join(':').trim();
    if (!targetId || (targetType !== 'verse' && targetType !== 'note')) return null;
    return { targetType, targetId };
  }

  function clearPendingTargetFromUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('ta_target')) return;
    url.searchParams.delete('ta_target');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }

  function flashTarget(element) {
    if (!element) return;
    element.classList.add('search-target-hit');
    window.setTimeout(() => element.classList.remove('search-target-hit'), 1600);
  }

  function findVerseNode(verseId) {
    if (!textRoot || !verseId) return null;
    return Array.from(textRoot.querySelectorAll('tei-l')).find((line) => {
      return line.getAttribute('xml:id') === verseId || line.getAttribute('id') === verseId;
    }) || null;
  }

  function goToVerse(verseId) {
    const verseNode = findVerseNode(verseId);
    if (!verseNode) return false;
    verseNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    flashTarget(verseNode);
    return true;
  }

  function goToNote(noteId, options = {}) {
    if (!new Set(getNavigableNoteIds()).has(noteId)) return false;
    const target = onOpenNote(noteId);
    if (!target) return false;
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    if (options.flash !== false) flashTarget(target);
    return true;
  }

  function consumePendingTarget() {
    if (!pendingTarget) return;
    const { targetType, targetId } = pendingTarget;
    const resolved = targetType === 'verse'
      ? goToVerse(targetId)
      : goToNote(targetId, { flash: true });

    if (resolved || (targetType === 'note' && !new Set(getNavigableNoteIds()).has(targetId))) {
      clearPendingTargetFromUrl();
      pendingTarget = null;
    }
  }

  function renderEmpty(message) {
    if (!results) return;
    const safeMessage = normalizeWhitespace(message || '');
    results.innerHTML = safeMessage
      ? `<p class="lectura-search-empty">${escapeHtml(safeMessage)}</p>`
      : '';
  }

  function buildResultItemHtml(result) {
    const doc = result?.doc || {};
    const sourceLabel = SOURCE_TYPE_LABELS[doc.sourceType] || doc.sourceType || 'Resultado';
    const title = escapeHtml(doc.title || 'Sin título');
    const preview = escapeHtml(doc.preview || doc.body || '');
    const meta = escapeHtml(doc.meta || '');

    return `
      <button type="button" class="lectura-search-result-item" data-target-type="${escapeHtml(doc.targetType || '')}" data-target-id="${escapeHtml(doc.targetId || '')}">
        <span class="lectura-search-result-kind">${escapeHtml(sourceLabel)}</span>
        <span class="lectura-search-result-title">${title}</span>
        ${meta ? `<span class="lectura-search-result-meta">${meta}</span>` : ''}
        ${preview ? `<span class="lectura-search-result-preview">${preview}</span>` : ''}
      </button>
    `;
  }

  function renderResults(foundResults, query) {
    if (!results) return;
    if (!foundResults.length) {
      renderEmpty(`Sin resultados para "${query}".`);
      return;
    }

    const grouped = groupResultsBySourceType(foundResults);
    results.innerHTML = ['lectura-verse', 'lectura-note'].map((sourceType) => {
      const items = grouped.get(sourceType);
      if (!items?.length) return '';
      return `
        <section class="lectura-search-group" data-source-type="${escapeHtml(sourceType)}">
          <header class="lectura-search-group-head">
            <h4>${escapeHtml(SOURCE_TYPE_LABELS[sourceType] || sourceType)}</h4>
            <span>${items.length}</span>
          </header>
          <div class="lectura-search-group-body">${items.map(buildResultItemHtml).join('')}</div>
        </section>
      `;
    }).join('');
  }

  function run() {
    if (!input || !indexState) return;
    const query = normalizeWhitespace(input.value);
    syncClearButton();
    if (!query) {
      setStatus('');
      renderEmpty('');
      return;
    }

    const visibleNoteIds = new Set(getNavigableNoteIds());
    const foundResults = searchIndex(indexState, query, {
      limit: indexState.normalizedDocs?.length || 80,
      sourceTypeBoost: { 'lectura-verse': 1.06, 'lectura-note': 1.14 }
    }).filter((result) => {
      return result?.doc?.sourceType !== 'lectura-note' || visibleNoteIds.has(result.doc.targetId);
    }).slice(0, 40);

    setStatus(`${foundResults.length} resultado(s) para "${query}".`);
    renderResults(foundResults, query);
  }

  function bind() {
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      run();
    });
    input.addEventListener('input', run);
    clearButton?.addEventListener('click', () => {
      input.value = '';
      run();
      input.focus();
    });
    results?.addEventListener('click', (event) => {
      const trigger = event.target instanceof Element
        ? event.target.closest('.lectura-search-result-item')
        : null;
      if (!trigger) return;
      const targetType = normalizeWhitespace(trigger.getAttribute('data-target-type'));
      const targetId = normalizeWhitespace(trigger.getAttribute('data-target-id'));
      if (targetType === 'verse') goToVerse(targetId);
      if (targetType === 'note') goToNote(targetId, { flash: false });
    });
    syncClearButton();
  }

  function initializeIndex() {
    if (!input || !results) return;
    if (typeof window.lunr !== 'function') {
      setStatus('Lunr no está disponible en esta vista.');
      renderEmpty('No se pudo activar la búsqueda en lectura.');
      return;
    }

    const docs = buildLecturaSearchDocsFromSources({
      textRoot,
      notesRoot: getNotesRoot(),
      baseUrl: '/lectura/'
    });
    if (!docs.length) {
      setStatus('No hay contenido indexable todavía.');
      renderEmpty('No hay contenido indexable todavía.');
      return;
    }

    indexState = buildIndex(docs, {
      fields: [
        { name: 'search_title', from: 'title', boost: 8 },
        { name: 'search_body', from: 'body', boost: 4 },
        { name: 'search_meta', from: 'meta', boost: 2 }
      ]
    });
    setStatus('');
    renderEmpty('');
    syncClearButton();
  }

  return { bind, consumePendingTarget, initializeIndex, run };
}
