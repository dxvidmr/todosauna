const NEXT_PASSAGE_CONTENT = '<span>Siguiente</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
const RANDOM_PASSAGE_CONTENT = '<i class="fa-solid fa-shuffle" aria-hidden="true"></i><span>Otro aleatorio</span>';

export function setPassageModeBadges(uis, label) {
  uis.forEach((ui) => {
    ui.root.querySelectorAll('[data-lab-mode-badge]').forEach((badge) => {
      badge.textContent = label;
    });
  });
}

export function setPassageModeAttributes(uis, mode) {
  uis.forEach((ui) => {
    if (!ui.controlsShell) return;

    if (mode) {
      ui.controlsShell.setAttribute('data-modo', mode);
    } else {
      ui.controlsShell.removeAttribute('data-modo');
    }
  });
}

export function setPassageProgressVisibility(uis, isVisible) {
  uis.forEach((ui) => {
    ui.root.querySelectorAll('[data-lab-passage-progress-container]').forEach((container) => {
      container.style.display = isVisible ? 'block' : 'none';
    });
  });
}

export function setPreviousPassageVisibility(uis, isVisible) {
  uis.forEach((ui) => {
    if (!ui.btnPrevPassage) return;
    ui.btnPrevPassage.hidden = !isVisible;
    ui.btnPrevPassage.style.display = isVisible ? 'inline-flex' : 'none';
  });
}

export function getPassageProgressPercent(mode, currentIndex, passageCount) {
  if (mode !== 'secuencial' || passageCount <= 0) return 0;
  return ((currentIndex + 1) / passageCount) * 100;
}

export function syncPassageProgress(uis, { mode, currentIndex, passageCount }) {
  const progress = getPassageProgressPercent(mode, currentIndex, passageCount);

  uis.forEach((ui) => {
    ui.root.querySelectorAll('[data-lab-passage-progress-fill]').forEach((fill) => {
      fill.style.width = `${progress}%`;
    });
  });
}

export function syncPassageNavigationButtons(uis, { mode, currentIndex, passageCount }) {
  uis.forEach((ui) => {
    const previousButton = ui.btnPrevPassage;
    const nextButton = ui.btnNextPassage;

    if (previousButton) {
      const isSequential = mode === 'secuencial';
      previousButton.hidden = !isSequential;
      previousButton.style.display = isSequential ? 'inline-flex' : 'none';
      previousButton.disabled = !isSequential || currentIndex <= 0;
    }

    if (!nextButton) return;

    if (mode === 'secuencial') {
      nextButton.disabled = currentIndex >= passageCount - 1;
      nextButton.innerHTML = NEXT_PASSAGE_CONTENT;
      nextButton.setAttribute('aria-label', 'Siguiente pasaje');
      return;
    }

    if (mode === 'aleatorio') {
      nextButton.disabled = false;
      nextButton.innerHTML = RANDOM_PASSAGE_CONTENT;
      nextButton.setAttribute('aria-label', 'Otro pasaje aleatorio');
      return;
    }

    nextButton.disabled = false;
    nextButton.innerHTML = NEXT_PASSAGE_CONTENT;
    nextButton.setAttribute('aria-label', 'Siguiente pasaje');
  });
}
