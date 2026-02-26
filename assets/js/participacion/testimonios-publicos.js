// ============================================
// PARTICIPACION: TESTIMONIOS PUBLICOS (F8.1-BIS)
// Fuente: CSV estatico local
// ============================================

(function () {
  if (typeof window === 'undefined') return;
  if (window.__TA_TESTIMONIOS_PUBLICOS_INIT__) return;

  var pageRoot = document.getElementById('archivo-testimonios-page');
  var loadingEl = document.getElementById('testimonios-publicos-loading');
  var errorEl = document.getElementById('testimonios-publicos-error');
  var emptyEl = document.getElementById('testimonios-publicos-empty');
  var listEl = document.getElementById('testimonios-publicos-list');
  var loadMoreBtn = document.getElementById('testimonios-publicos-load-more');
  var searchInput = document.getElementById('testimonios-publicos-search');
  var contextSelect = document.getElementById('testimonios-publicos-context');
  var clearBtn = document.getElementById('testimonios-publicos-clear');
  var summaryEl = document.getElementById('testimonios-publicos-summary');

  if (!pageRoot || !loadingEl || !errorEl || !emptyEl || !listEl || !loadMoreBtn || !searchInput || !contextSelect || !clearBtn || !summaryEl) {
    return;
  }

  window.__TA_TESTIMONIOS_PUBLICOS_INIT__ = true;

  var pageSize = 12;
  var csvUrl = String(pageRoot.getAttribute('data-csv-url') || '/assets/data/testimonios-publicados.csv').trim();
  var itemsBase = String(pageRoot.getAttribute('data-items-base') || '/items/').trim();

  var contextoLabels = {
    personal: 'Personal',
    academico: 'Académico',
    profesional: 'Profesional',
    otro: 'Otro'
  };

  var rangoEdadLabels = {
    menos_de_18: 'Menos de 18',
    '18_25': '18-25',
    '26_35': '26-35',
    '36_50': '36-50',
    '51_65': '51-65',
    mas_de_65: 'Más de 65'
  };

  var state = {
    loading: false,
    allRows: [],
    filteredRows: [],
    visibleCount: 0,
    seenIds: new Set(),
    searchTerm: '',
    contextValue: ''
  };

  function setVisible(el, show) {
    el.hidden = !show;
  }

  function toText(value) {
    var normalized = String(value == null ? '' : value).trim();
    return normalized ? normalized : '';
  }

  function toLower(value) {
    return toText(value).toLowerCase();
  }

  function formatDate(dateValue) {
    var normalized = toText(dateValue);
    if (!normalized) return '';

    var parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return normalized;

    try {
      return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(parsed);
    } catch (_err) {
      return parsed.toLocaleDateString('es-ES');
    }
  }

  function isHttpUrl(value) {
    try {
      var parsed = new URL(String(value || ''));
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_err) {
      return false;
    }
  }

  function ensureTrailingSlash(path) {
    if (!path) return '/items/';
    return path.charAt(path.length - 1) === '/' ? path : path + '/';
  }

  function resolveInternalHref(refValue) {
    var ref = toText(refValue);
    if (!ref) return '';

    if (isHttpUrl(ref)) return '';

    if (ref.indexOf('/items/') === 0) return ref;
    if (ref.indexOf('items/') === 0) return '/' + ref;

    if (/\.html($|#|\?)/i.test(ref)) {
      if (ref.indexOf('/') === 0) return ref;
      return '/' + ref;
    }

    if (/^[A-Za-z0-9._:-]+$/.test(ref)) {
      return ensureTrailingSlash(itemsBase) + encodeURIComponent(ref) + '.html';
    }

    return '';
  }

  function parseLinkedArchiveRefs(rawValue) {
    if (Array.isArray(rawValue)) {
      return rawValue.map(toText).filter(Boolean);
    }

    var raw = toText(rawValue);
    if (!raw) return [];

    if (raw.charAt(0) === '[') {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(toText).filter(Boolean);
        }
      } catch (_error) {
        // fallback to delimiter parsing
      }
    }

    return raw
      .split(/[;\n]+/)
      .map(toText)
      .filter(Boolean);
  }

  function buildSearchBlob(row) {
    return [
      row.titulo,
      row.testimonio,
      row.display_name,
      row.experiencia_ciudad_nombre,
      row.experiencia_pais_nombre,
      row.experiencia_lugar_texto,
      row.experiencia_contexto,
      row.experiencia_fecha_texto
    ]
      .map(toLower)
      .join(' ');
  }

  function normalizeRow(raw) {
    var row = {
      testimonio_id: toText(raw.testimonio_id),
      created_at: toText(raw.created_at),
      titulo: toText(raw.titulo),
      testimonio: toText(raw.testimonio),
      display_name: toText(raw.display_name),
      experiencia_fecha: toText(raw.experiencia_fecha),
      experiencia_fecha_texto: toText(raw.experiencia_fecha_texto),
      experiencia_ciudad_nombre: toText(raw.experiencia_ciudad_nombre),
      experiencia_pais_nombre: toText(raw.experiencia_pais_nombre),
      experiencia_lugar_texto: toText(raw.experiencia_lugar_texto),
      experiencia_contexto: toText(raw.experiencia_contexto),
      experiencia_rango_edad: toText(raw.experiencia_rango_edad),
      linked_archive_refs: parseLinkedArchiveRefs(raw.linked_archive_refs)
    };

    row._createdAtTs = Date.parse(row.created_at) || 0;
    row._search = buildSearchBlob(row);
    return row;
  }

  function parseCsvText(csvText) {
    if (!window.Papa || typeof window.Papa.parse !== 'function') {
      throw new Error('No se pudo inicializar el parser CSV local.');
    }

    var normalizedCsv = String(csvText || '');
    if (normalizedCsv.charCodeAt(0) === 0xfeff) {
      normalizedCsv = normalizedCsv.slice(1);
    }

    var result = window.Papa.parse(normalizedCsv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    if (result.errors && result.errors.length) {
      var seriousErrors = result.errors.filter(function (err) {
        return err && err.code !== 'UndetectableDelimiter';
      });
      if (seriousErrors.length) {
        throw new Error('El archivo CSV de testimonios contiene errores de formato.');
      }
    }

    if (!Array.isArray(result.data)) return [];
    return result.data;
  }

  function setLoading(loading) {
    state.loading = !!loading;
    setVisible(loadingEl, state.loading);
    listEl.setAttribute('aria-busy', state.loading ? 'true' : 'false');

    if (state.loading) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Cargando...';
      return;
    }

    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Cargar más';
  }

  function setError(message) {
    errorEl.textContent = toText(message) || 'No se pudieron cargar los testimonios.';
    setVisible(errorEl, true);
  }

  function clearError() {
    errorEl.textContent = '';
    setVisible(errorEl, false);
  }

  function renderMarkdown(markdownText, target) {
    var content = toText(markdownText);
    if (!content) {
      target.textContent = '';
      target.classList.remove('is-plain-text');
      return;
    }

    var hasMarked = window.marked && typeof window.marked.parse === 'function';
    var hasPurify = window.DOMPurify && typeof window.DOMPurify.sanitize === 'function';

    if (hasMarked && hasPurify) {
      try {
        var html = window.marked.parse(content, {
          gfm: true,
          breaks: true
        });
        target.innerHTML = window.DOMPurify.sanitize(html, {
          USE_PROFILES: { html: true }
        });
        target.classList.remove('is-plain-text');
        return;
      } catch (_err) {
        // fallback to plain text
      }
    }

    target.textContent = content;
    target.classList.add('is-plain-text');
  }

  function appendContextItem(list, label, value) {
    var text = toText(value);
    if (!text) return;

    var li = document.createElement('li');
    li.className = 'archivo-testimonios-context-item';

    var strong = document.createElement('strong');
    strong.textContent = label + ': ';

    var span = document.createElement('span');
    span.textContent = text;

    li.appendChild(strong);
    li.appendChild(span);
    list.appendChild(li);
  }

  function buildContextEntries(row) {
    var entries = [];

    var dateParts = [];
    var fecha = formatDate(row.experiencia_fecha);
    if (fecha) dateParts.push(fecha);
    if (row.experiencia_fecha_texto) dateParts.push(row.experiencia_fecha_texto);
    if (dateParts.length) {
      entries.push({ label: 'Fecha', value: dateParts.join(' · ') });
    }

    if (row.experiencia_ciudad_nombre) entries.push({ label: 'Ciudad', value: row.experiencia_ciudad_nombre });
    if (row.experiencia_pais_nombre) entries.push({ label: 'País', value: row.experiencia_pais_nombre });
    if (row.experiencia_lugar_texto) entries.push({ label: 'Lugar', value: row.experiencia_lugar_texto });

    if (row.experiencia_contexto) {
      entries.push({
        label: 'Contexto',
        value: contextoLabels[row.experiencia_contexto] || row.experiencia_contexto
      });
    }

    if (row.experiencia_rango_edad) {
      entries.push({
        label: 'Rango de edad',
        value: rangoEdadLabels[row.experiencia_rango_edad] || row.experiencia_rango_edad
      });
    }

    return entries;
  }

  function createLinksSection(refs) {
    if (!Array.isArray(refs) || !refs.length) return null;

    var section = document.createElement('section');
    section.className = 'archivo-testimonios-links';

    var title = document.createElement('h3');
    title.className = 'archivo-testimonios-subtitle';
    title.textContent = 'Vínculos relacionados';
    section.appendChild(title);

    var list = document.createElement('ul');
    list.className = 'archivo-testimonios-links-list';

    refs.forEach(function (refValue) {
      var ref = toText(refValue);
      if (!ref) return;

      var li = document.createElement('li');
      var external = isHttpUrl(ref);
      var internalHref = external ? '' : resolveInternalHref(ref);
      var href = external ? ref : internalHref;

      if (href) {
        var link = document.createElement('a');
        link.href = href;
        link.textContent = 'Ver registro';
        if (external) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        li.appendChild(link);

        var code = document.createElement('code');
        code.textContent = ref;
        code.className = 'archivo-testimonios-link-ref';
        li.appendChild(code);
      } else {
        var codeOnly = document.createElement('code');
        codeOnly.textContent = ref;
        li.appendChild(codeOnly);
      }

      list.appendChild(li);
    });

    if (!list.children.length) return null;
    section.appendChild(list);
    return section;
  }

  function createCard(row) {
    var card = document.createElement('article');
    card.className = 'archivo-testimonios-card card card-soft p-3 p-md-4';

    var title = document.createElement('h2');
    title.className = 'archivo-testimonios-title';
    title.textContent = row.titulo || 'Testimonio sin título';
    card.appendChild(title);

    var metaParts = [];
    if (row.display_name) metaParts.push('Por ' + row.display_name);
    if (row.created_at) metaParts.push('Publicado el ' + formatDate(row.created_at));

    if (metaParts.length) {
      var meta = document.createElement('p');
      meta.className = 'archivo-testimonios-meta';
      meta.textContent = metaParts.join(' · ');
      card.appendChild(meta);
    }

    var body = document.createElement('div');
    body.className = 'archivo-testimonios-body';
    renderMarkdown(row.testimonio, body);
    card.appendChild(body);

    var entries = buildContextEntries(row);
    if (entries.length) {
      var contextSection = document.createElement('section');
      contextSection.className = 'archivo-testimonios-context';

      var contextTitle = document.createElement('h3');
      contextTitle.className = 'archivo-testimonios-subtitle';
      contextTitle.textContent = 'Contexto';
      contextSection.appendChild(contextTitle);

      var contextList = document.createElement('ul');
      contextList.className = 'archivo-testimonios-context-list';
      entries.forEach(function (entry) {
        appendContextItem(contextList, entry.label, entry.value);
      });

      contextSection.appendChild(contextList);
      card.appendChild(contextSection);
    }

    var links = createLinksSection(row.linked_archive_refs);
    if (links) card.appendChild(links);

    return card;
  }

  function rowMatchesFilters(row) {
    if (state.contextValue) {
      if (toLower(row.experiencia_contexto) !== state.contextValue) return false;
    }

    if (!state.searchTerm) return true;
    return row._search.indexOf(state.searchTerm) !== -1;
  }

  function applyFilters() {
    state.filteredRows = state.allRows.filter(rowMatchesFilters);
    state.visibleCount = Math.min(pageSize, state.filteredRows.length);
    renderCurrentView();
  }

  function renderCurrentView() {
    listEl.innerHTML = '';
    state.seenIds.clear();

    clearError();

    if (!state.filteredRows.length) {
      setVisible(emptyEl, true);
      setVisible(loadMoreBtn, false);
      summaryEl.textContent = '0 testimonios';
      return;
    }

    setVisible(emptyEl, false);

    var visibleRows = state.filteredRows.slice(0, state.visibleCount);
    visibleRows.forEach(function (row) {
      var rowId = row.testimonio_id || '';
      if (rowId && state.seenIds.has(rowId)) return;
      if (rowId) state.seenIds.add(rowId);
      listEl.appendChild(createCard(row));
    });

    var hasMore = state.visibleCount < state.filteredRows.length;
    setVisible(loadMoreBtn, hasMore);
    summaryEl.textContent = 'Mostrando ' + visibleRows.length + ' de ' + state.filteredRows.length + ' testimonios';
  }

  function handleLoadMore() {
    if (state.loading) return;
    state.visibleCount = Math.min(state.visibleCount + pageSize, state.filteredRows.length);
    renderCurrentView();
  }

  function handleSearchInput() {
    state.searchTerm = toLower(searchInput.value);
    applyFilters();
  }

  function handleContextChange() {
    state.contextValue = toLower(contextSelect.value);
    applyFilters();
  }

  function clearFilters() {
    searchInput.value = '';
    contextSelect.value = '';
    state.searchTerm = '';
    state.contextValue = '';
    applyFilters();
  }

  async function loadCsv() {
    setLoading(true);
    clearError();

    try {
      var response = await fetch(csvUrl, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error('No se pudo cargar el archivo de testimonios publicados.');
      }

      var csvText = await response.text();
      var parsedRows = parseCsvText(csvText);

      state.allRows = parsedRows
        .map(normalizeRow)
        .filter(function (row) {
          return !!(row.titulo || row.testimonio);
        })
        .sort(function (a, b) {
          return b._createdAtTs - a._createdAtTs;
        });

      state.filteredRows = state.allRows.slice();
      state.visibleCount = Math.min(pageSize, state.filteredRows.length);
      renderCurrentView();
    } catch (error) {
      listEl.innerHTML = '';
      setVisible(emptyEl, false);
      setVisible(loadMoreBtn, false);
      summaryEl.textContent = '';

      var message = error && error.message ? error.message : 'No se pudieron cargar los testimonios.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  loadMoreBtn.addEventListener('click', handleLoadMore);
  searchInput.addEventListener('input', handleSearchInput);
  contextSelect.addEventListener('change', handleContextChange);
  clearBtn.addEventListener('click', clearFilters);

  void loadCsv();
})();
