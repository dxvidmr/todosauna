function setTextForAll(uis, selector, value) {
  const text = String(value);
  uis.forEach((ui) => {
    ui.root.querySelectorAll(selector).forEach((element) => {
      element.textContent = text;
    });
  });
}

export function syncLaboratorioNoteToggle(button, { hasNotes, isExpanded }) {
  if (!button) return;
  button.disabled = !hasNotes;
  button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  const label = button.querySelector('[data-lab-note-toggle-label]');
  if (label) label.textContent = 'Notas';
}

export function syncLaboratorioNoteProgress(uis, { evaluatedCount, noteCount }) {
  const total = Math.max(1, noteCount);
  const percentage = (evaluatedCount / total) * 100;
  uis.forEach((ui) => {
    ui.root.querySelectorAll('[data-lab-note-progress-fill], [data-lab-note-progress-fill-collapsed]').forEach((fill) => {
      fill.style.width = `${percentage}%`;
    });
  });
}

export function syncLaboratorioNoteCounters(uis, { currentIndex, evaluatedCount, noteCount }) {
  setTextForAll(uis, '[data-lab-notes-total]', noteCount);
  setTextForAll(uis, '[data-lab-notes-evaluated]', evaluatedCount);
  setTextForAll(uis, '[data-lab-notes-passage-total]', noteCount);
  setTextForAll(uis, '[data-lab-notes-total-resumen]', noteCount);
  setTextForAll(uis, '[data-lab-notes-evaluated-resumen]', evaluatedCount);
  setTextForAll(uis, '[data-lab-note-index]', currentIndex >= 0 ? currentIndex + 1 : 0);
}

export function syncLaboratorioNoteNavigation(uis, { currentIndex, noteCount }) {
  const hasNotes = noteCount > 0;
  const canOpenFirst = currentIndex === -1 && hasNotes;

  uis.forEach((ui) => {
    if (ui.btnPrevNote) {
      ui.btnPrevNote.disabled = !hasNotes || currentIndex <= 0;
    }
    if (ui.btnNextNote) {
      ui.btnNextNote.disabled = !hasNotes || (!canOpenFirst && currentIndex >= noteCount - 1);
    }
  });
}
