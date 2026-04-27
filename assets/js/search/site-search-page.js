import store from '../lunr-store.js';
import {
  SOURCE_TYPE_LABELS,
  buildIndex,
  groupResultsBySourceType,
  searchIndex
} from './lunr-core.js';
import { buildLecturaSearchDocsFromUrls } from './lectura-search-docs.js';

const SOURCE_RENDER_ORDER = ['page', 'collection', 'lectura-verse', 'lectura-note'];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function collapseWhitespace(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function getQueryFromUrl() {
  const params = new URLSearchParams(window.location.search || '');
  return collapseWhitespace(params.get('q') || '');
}

function syncQueryInUrl(query) {
  const url = new URL(window.location.href);
  if (query) {
    url.searchParams.set('q', query);
  } else {
    url.searchParams.delete('q');
  }
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

function renderEmptyState(resultsHost, query) {
  const safeQuery = escapeHtml(query);
  resultsHost.innerHTML = query
    ? `<p class="text-muted mb-0">No se encontraron resultados para <strong>${safeQuery}</strong>.</p>`
    : '<p class="text-muted mb-0">Introduce un término para buscar.</p>';
}

function renderGroupedResults(resultsHost, results, query) {
  if (!results.length) {
    renderEmptyState(resultsHost, query);
    return;
  }

  const grouped = groupResultsBySourceType(results);
  const sections = [];

  SOURCE_RENDER_ORDER.forEach(sourceType => {
    const groupItems = grouped.get(sourceType);
    if (!groupItems || !groupItems.length) return;

    const groupLabel = SOURCE_TYPE_LABELS[sourceType] || sourceType;
    const itemsHtml = groupItems.map(result => {
      const doc = result.doc || {};
      const title = escapeHtml(doc.title || 'Sin título');
      const preview = escapeHtml(doc.preview || doc.body || '');
      const href = escapeHtml(doc.url || '#');
      const meta = escapeHtml(doc.meta || '');

      return `
        <article class="site-search-result-item">
          <h4 class="site-search-result-title mb-1">
            <a href="${href}">${title}</a>
          </h4>
          ${meta ? `<p class="site-search-result-meta mb-1">${meta}</p>` : ''}
          ${preview ? `<p class="site-search-result-preview mb-0">${preview}</p>` : ''}
        </article>
      `;
    }).join('');

    sections.push(`
      <section class="site-search-result-group" data-source-type="${escapeHtml(sourceType)}">
        <header class="site-search-result-group-head d-flex justify-content-between align-items-center mb-2">
          <h3 class="h5 mb-0">${escapeHtml(groupLabel)}</h3>
          <span class="badge text-bg-light border">${groupItems.length}</span>
        </header>
        <div class="site-search-result-group-body">
          ${itemsHtml}
        </div>
      </section>
    `);
  });

  resultsHost.innerHTML = `
    <p class="text-muted mb-3">${results.length} resultado(s) para <strong>${escapeHtml(query)}</strong>.</p>
    <div class="site-search-results-groups">${sections.join('')}</div>
  `;
}

async function createUnifiedIndex(statusHost) {
  const docs = Array.isArray(store) ? [...store] : [];
  const config = window.TASearchConfig || {};

  try {
    const lecturaDocs = await buildLecturaSearchDocsFromUrls({
      teiUrl: config.teiUrl,
      notesUrl: config.notesUrl,
      baseUrl: config.lecturaUrl || '/lectura/'
    });
    docs.push(...lecturaDocs);
  } catch (error) {
    console.warn('No se pudo incorporar /lectura al índice global:', error);
  }

  const indexState = buildIndex(docs, {
    fields: [
      { name: 'search_title', from: 'title', boost: 8 },
      { name: 'search_body', from: 'body', boost: 3 },
      { name: 'search_meta', from: 'meta', boost: 2 }
    ],
    sourceTypeBoost: {
      page: 1.05,
      collection: 1,
      'lectura-verse': 1.1,
      'lectura-note': 1.12
    }
  });

  if (statusHost) {
    statusHost.textContent = `${docs.length} documentos indexados.`;
  }

  return indexState;
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('siteSearchForm');
  const input = document.getElementById('lunrSearchBox');
  const resultsHost = document.getElementById('lunrResults');
  const statusHost = document.getElementById('lunrStatus');

  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(resultsHost instanceof HTMLElement)) {
    return;
  }

  if (typeof window.lunr !== 'function') {
    if (statusHost) {
      statusHost.textContent = 'No se pudo inicializar Lunr en esta página.';
    }
    renderEmptyState(resultsHost, '');
    return;
  }

  const queryFromUrl = getQueryFromUrl();
  if (queryFromUrl) {
    input.value = queryFromUrl;
  }

  if (statusHost) {
    statusHost.textContent = 'Construyendo índice de búsqueda…';
  }

  let indexState;
  try {
    indexState = await createUnifiedIndex(statusHost);
  } catch (error) {
    console.error('Error construyendo índice global:', error);
    if (statusHost) {
      statusHost.textContent = 'Error al construir el índice de búsqueda.';
    }
    renderEmptyState(resultsHost, queryFromUrl);
    return;
  }

  const runSearch = () => {
    const query = collapseWhitespace(input.value);
    syncQueryInUrl(query);
    const results = searchIndex(indexState, query, { limit: 120 });
    renderGroupedResults(resultsHost, results, query);
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    runSearch();
  });

  if (queryFromUrl) {
    runSearch();
  } else {
    renderEmptyState(resultsHost, '');
  }
});
