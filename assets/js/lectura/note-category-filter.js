import {
  TIPO_NOTA_DESC_MAP,
  TIPO_NOTA_MAP,
  TIPO_NOTA_ORDER,
  normalizeAnaCategories
} from './notas-dom.js';

const DEFAULT_STORAGE_KEY = 'todosauna:lectura:note-categories:v1';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getNoteId(note) {
  if (!note || typeof note.getAttribute !== 'function') return '';
  return String(note.getAttribute('xml:id') || note.getAttribute('id') || '').trim();
}

function readStoredSelection(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch (error) {
    return null;
  }
}

function persistSelection(storageKey, selectedCategories) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(selectedCategories)));
  } catch (error) {
    // El filtro sigue funcionando aunque el navegador bloquee localStorage.
  }
}

function createNoteCategoryFilterController(options = {}) {
  const root = options.root || null;
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
  const onChange = typeof options.onChange === 'function' ? options.onChange : null;
  const optionsTabButton = options.optionsTabButton || null;

  if (!root) {
    return {
      setNotes() {},
      getSelectedCategories() { return new Set(); },
      isNoteVisible() { return true; }
    };
  }

  const allCheckbox = root.querySelector('[data-note-category-all]');
  const noneButton = root.querySelector('[data-note-category-none]');
  const resetButton = root.querySelector('[data-note-category-reset]');
  const toggleButton = root.querySelector('[data-note-category-toggle]');
  const collapsibleBody = root.querySelector('[data-note-category-body]');
  const list = root.querySelector('[data-note-category-list]');
  const summary = root.querySelector('[data-note-category-summary]');
  const filterIndicator = optionsTabButton?.querySelector('.note-filter-indicator') || null;

  let noteRecords = [];
  let categoryIds = [];
  let selectedCategories = null;

  function getVisibleNoteIds() {
    if (!(selectedCategories instanceof Set)) return new Set(noteRecords.map(record => record.id));
    return new Set(
      noteRecords
        .filter(record => record.categories.some(category => selectedCategories.has(category)))
        .map(record => record.id)
    );
  }

  function isFullySelected() {
    return categoryIds.length > 0 && categoryIds.every(category => selectedCategories.has(category));
  }

  function syncControls({ notify = true, persist = true } = {}) {
    if (!(selectedCategories instanceof Set)) selectedCategories = new Set(categoryIds);

    const selectedCount = categoryIds.filter(category => selectedCategories.has(category)).length;
    const allSelected = isFullySelected();
    const partiallySelected = selectedCount > 0 && !allSelected;
    const visibleNoteIds = getVisibleNoteIds();

    list?.querySelectorAll('[data-note-category]').forEach(input => {
      input.checked = selectedCategories.has(input.value);
    });

    if (allCheckbox) {
      allCheckbox.checked = allSelected;
      allCheckbox.indeterminate = partiallySelected;
    }

    if (resetButton) resetButton.hidden = allSelected;
    root.classList.toggle('is-filtered', !allSelected);
    optionsTabButton?.classList.toggle('has-active-filter', !allSelected);
    if (filterIndicator) filterIndicator.hidden = allSelected;

    if (summary) {
      const visibleCount = visibleNoteIds.size;
      if (selectedCount === 0) {
        summary.textContent = `0 de ${categoryIds.length} tipologías · ninguna nota visible`;
      } else {
        const noteLabel = visibleCount === 1 ? 'nota visible' : 'notas visibles';
        summary.textContent = `${selectedCount} de ${categoryIds.length} tipologías · ${visibleCount} ${noteLabel}`;
      }
    }

    if (persist) persistSelection(storageKey, selectedCategories);
    if (notify && onChange) {
      onChange({
        selectedCategories: new Set(selectedCategories),
        visibleNoteIds,
        isFiltered: !allSelected
      });
    }
  }

  function setSelection(categories, syncOptions) {
    const allowed = new Set(categoryIds);
    selectedCategories = new Set(
      Array.from(categories || []).filter(category => allowed.has(category))
    );
    syncControls(syncOptions);
  }

  function renderCategories() {
    if (!list) return;

    const counts = new Map(categoryIds.map(category => [category, 0]));
    noteRecords.forEach(record => {
      record.categories.forEach(category => {
        if (counts.has(category)) counts.set(category, counts.get(category) + 1);
      });
    });

    list.innerHTML = categoryIds.map(category => {
      const label = TIPO_NOTA_MAP[category] || category;
      const description = TIPO_NOTA_DESC_MAP[category] || '';
      const count = counts.get(category) || 0;
      const inputId = `note-category-${category}`;

      return `
        <label class="note-category-option" for="${escapeHtml(inputId)}"${description ? ` title="${escapeHtml(description)}"` : ''}>
          <input class="form-check-input" type="checkbox" id="${escapeHtml(inputId)}" value="${escapeHtml(category)}" data-note-category>
          <span class="note-category-option-label">${escapeHtml(label)}</span>
          <span class="note-category-option-count" aria-label="${count} notas">${count}</span>
        </label>
      `;
    }).join('');
  }

  function setNotes(notes) {
    noteRecords = Array.from(notes || []).map(note => ({
      id: getNoteId(note),
      categories: normalizeAnaCategories(note?.getAttribute?.('ana') || '')
    })).filter(record => record.id);

    const availableCategories = new Set(
      noteRecords.flatMap(record => record.categories)
    );
    const knownCategories = TIPO_NOTA_ORDER.filter(category => availableCategories.has(category));
    const extraCategories = Array.from(availableCategories)
      .filter(category => !TIPO_NOTA_ORDER.includes(category))
      .sort((a, b) => a.localeCompare(b, 'es'));
    categoryIds = [...knownCategories, ...extraCategories];

    if (!(selectedCategories instanceof Set)) {
      const storedSelection = readStoredSelection(storageKey);
      selectedCategories = storedSelection == null
        ? new Set(categoryIds)
        : new Set(storedSelection.filter(category => availableCategories.has(category)));
    }

    renderCategories();
    syncControls({ notify: true, persist: false });
  }

  allCheckbox?.addEventListener('change', () => {
    setSelection(allCheckbox.checked ? categoryIds : []);
  });

  noneButton?.addEventListener('click', () => {
    setSelection([]);
  });

  resetButton?.addEventListener('click', () => {
    setSelection(categoryIds);
  });

  toggleButton?.addEventListener('click', () => {
    const expanded = toggleButton.getAttribute('aria-expanded') === 'true';
    toggleButton.setAttribute('aria-expanded', String(!expanded));
    if (collapsibleBody) collapsibleBody.hidden = expanded;
  });

  list?.addEventListener('change', event => {
    const input = event.target instanceof HTMLInputElement
      ? event.target.closest('[data-note-category]')
      : null;
    if (!input) return;

    const nextSelection = new Set(selectedCategories);
    if (input.checked) nextSelection.add(input.value);
    else nextSelection.delete(input.value);
    setSelection(nextSelection);
  });

  return {
    setNotes,
    getSelectedCategories() {
      return new Set(selectedCategories || categoryIds);
    },
    isNoteVisible(note) {
      const categories = normalizeAnaCategories(note?.getAttribute?.('ana') || '');
      if (!(selectedCategories instanceof Set)) return true;
      return categories.some(category => selectedCategories.has(category));
    }
  };
}

export {
  DEFAULT_STORAGE_KEY,
  createNoteCategoryFilterController
};
