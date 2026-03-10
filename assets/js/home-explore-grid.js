import {
  crearBotonesConContadores,
  attachEvaluationListeners,
  registrarEvaluacion
} from './participacion/evaluaciones.js';

(function () {
  'use strict';

  const GRID_SELECTOR = '[data-home-grid]';
  const ROTATOR_IMAGE_SELECTOR = '[data-home-rotator-image]';
  const ROTATOR_CARD_SELECTOR = '[data-home-rotator-card]';
  const EVAL_CARD_SELECTOR = '[data-home-eval-card]';

  const NOTE_MAX_CHARS = 280;
  const ROTATOR_INTERVAL_MS = 4200;
  const ROTATOR_FADE_MS = 180;

  function toText(value) {
    return String(value == null ? '' : value).trim();
  }

  function parseDelimited(value) {
    return toText(value)
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function pickRandom(items) {
    if (!Array.isArray(items) || !items.length) return null;
    const index = Math.floor(Math.random() * items.length);
    return items[index];
  }

  function stripHtml(value) {
    return toText(value)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function truncate(value, maxChars) {
    const normalized = stripHtml(value);
    if (normalized.length <= maxChars) return normalized;
    return normalized.slice(0, maxChars).trim() + '...';
  }

  function initImageRotator(grid) {
    const image = grid.querySelector(ROTATOR_IMAGE_SELECTOR);
    if (!image) return;

    const sources = parseDelimited(image.getAttribute('data-rotator-sources'));
    const alts = parseDelimited(image.getAttribute('data-rotator-alts'));
    if (sources.length < 2) return;

    const card = image.closest(ROTATOR_CARD_SELECTOR) || image;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let currentIndex = 0;
    let intervalId = 0;
    let fadeTimeoutId = 0;

    function stop() {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
      if (fadeTimeoutId) {
        window.clearTimeout(fadeTimeoutId);
        fadeTimeoutId = 0;
      }
      image.classList.remove('is-fading');
    }

    function applySlide(nextIndex) {
      currentIndex = nextIndex;
      image.classList.add('is-fading');

      fadeTimeoutId = window.setTimeout(function () {
        image.setAttribute('src', sources[currentIndex]);
        if (alts[currentIndex]) {
          image.setAttribute('alt', alts[currentIndex]);
        }
        image.classList.remove('is-fading');
      }, ROTATOR_FADE_MS);
    }

    function nextSlide() {
      const nextIndex = (currentIndex + 1) % sources.length;
      applySlide(nextIndex);
    }

    function start() {
      if (intervalId || prefersReducedMotion.matches || document.hidden) return;
      intervalId = window.setInterval(nextSlide, ROTATOR_INTERVAL_MS);
    }

    function handleMotionChange() {
      if (prefersReducedMotion.matches) {
        stop();
        return;
      }
      start();
    }

    card.addEventListener('mouseenter', stop);
    card.addEventListener('mouseleave', start);
    card.addEventListener('focusin', stop);
    card.addEventListener('focusout', start);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    if (prefersReducedMotion.addEventListener) {
      prefersReducedMotion.addEventListener('change', handleMotionChange);
    } else if (prefersReducedMotion.addListener) {
      prefersReducedMotion.addListener(handleMotionChange);
    }

    start();
  }

  class HomeEvaluationCard {
    constructor(card) {
      this.card = card;
      this.noteText = card.querySelector('[data-home-note-text]');
      this.noteId = card.querySelector('[data-home-note-id]');
      this.controls = card.querySelector('[data-home-eval-controls]');
      this.status = card.querySelector('[data-home-eval-status]');
      this.nextButton = card.querySelector('[data-home-next-note]');

      this.notes = [];
      this.evaluatedNoteIds = new Set();
      this.activeNote = null;
    }

    setStatus(message, tone) {
      if (!this.status) return;
      this.status.textContent = toText(message);
      this.status.classList.remove('is-error', 'is-success');
      if (tone === 'error') this.status.classList.add('is-error');
      if (tone === 'success') this.status.classList.add('is-success');
    }

    setLoadingState(loading) {
      const isLoading = !!loading;
      if (this.card) {
        this.card.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      }
      if (this.nextButton) {
        this.nextButton.disabled = isLoading;
      }
    }

    getApi() {
      return window.Participacion && window.Participacion.apiV2
        ? window.Participacion.apiV2
        : null;
    }

    async ensureSession() {
      const session = window.Participacion && window.Participacion.session
        ? window.Participacion.session
        : null;
      if (!session || typeof session.init !== 'function') return false;

      await session.init();
      const publicData = session.getPublicSessionData ? session.getPublicSessionData() : null;
      return !!(publicData && publicData.session_id);
    }

    async loadNotes() {
      const api = this.getApi();
      if (!api) {
        throw new Error('API de participacion no disponible');
      }

      const notesResult = await api.getNotasActivas();
      if (notesResult.error || !Array.isArray(notesResult.data)) {
        throw new Error('No se pudieron cargar las notas activas');
      }

      const noteCountsResult = await api.getNoteEvalCounts();
      const countMap = new Map();
      if (!noteCountsResult.error && Array.isArray(noteCountsResult.data)) {
        noteCountsResult.data.forEach((row) => {
          const noteId = toText(row.nota_id);
          if (!noteId) return;
          countMap.set(noteId, {
            total: Number(row.total || 0),
            utiles: Number(row.utiles || 0),
            mejorables: Number(row.mejorables || 0)
          });
        });
      }

      const eligibleNotes = notesResult.data
        .filter((note) => toText(note.nota_id) && toText(note.texto_nota))
        .map((note) => {
          const noteId = toText(note.nota_id);
          return {
            nota_id: noteId,
            texto_nota: toText(note.texto_nota),
            version: toText(note.version || '1.0'),
            evaluaciones: countMap.get(noteId) || { total: 0, utiles: 0, mejorables: 0 }
          };
        });

      this.notes = eligibleNotes;
    }

    async loadEvaluatedNoteIds() {
      const api = this.getApi();
      const session = window.Participacion && window.Participacion.session
        ? window.Participacion.session
        : null;

      if (!api || !session || typeof session.getPublicSessionData !== 'function') {
        this.evaluatedNoteIds = new Set();
        return;
      }

      const sessionData = session.getPublicSessionData();
      if (!sessionData || !sessionData.session_id) {
        this.evaluatedNoteIds = new Set();
        return;
      }

      const evaluatedResult = await api.getSessionEvaluatedNotes(sessionData.session_id);
      if (evaluatedResult.error || !Array.isArray(evaluatedResult.data)) {
        this.evaluatedNoteIds = new Set();
        return;
      }

      this.evaluatedNoteIds = new Set(
        evaluatedResult.data
          .map((row) => toText(row.nota_id))
          .filter(Boolean)
      );
    }

    pickNextNote() {
      const candidates = this.notes.filter((note) => !this.evaluatedNoteIds.has(note.nota_id));
      if (!candidates.length) return null;

      if (candidates.length === 1) {
        return candidates[0];
      }

      const withoutCurrent = this.activeNote
        ? candidates.filter((candidate) => candidate.nota_id !== this.activeNote.nota_id)
        : candidates;

      return pickRandom(withoutCurrent.length ? withoutCurrent : candidates);
    }

    showFallback(message) {
      if (this.noteText) {
        this.noteText.textContent = 'No hay una nota lista para evaluar en este momento.';
      }
      if (this.noteId) {
        this.noteId.textContent = '';
      }
      if (this.controls) {
        this.controls.innerHTML = '';
      }
      if (this.nextButton) {
        this.nextButton.hidden = true;
        this.nextButton.disabled = true;
      }
      this.setStatus(message || 'Abre el laboratorio para seguir evaluando notas.', 'error');
    }

    handleVoteSuccess(noteId) {
      this.evaluatedNoteIds.add(noteId);
      if (this.controls) {
        this.controls.innerHTML = '<div class="home-eval-done"><i class="fa-solid fa-check-circle" aria-hidden="true"></i> Nota evaluada en esta sesion.</div>';
      }
      if (this.nextButton) {
        this.nextButton.hidden = false;
        this.nextButton.disabled = false;
      }
      this.setStatus('Gracias por colaborar. Puedes evaluar otra nota cuando quieras.', 'success');
    }

    renderNote(note) {
      this.activeNote = note;

      if (this.noteText) {
        this.noteText.textContent = truncate(note.texto_nota, NOTE_MAX_CHARS);
      }

      if (this.noteId) {
        this.noteId.textContent = 'Nota ' + note.nota_id;
      }

      if (this.controls) {
        const block = document.createElement('div');
        block.className = 'nota-evaluacion';
        block.setAttribute('data-note-id', note.nota_id);
        block.innerHTML = crearBotonesConContadores(note.nota_id, note.version, note.evaluaciones);

        this.controls.innerHTML = '';
        this.controls.appendChild(block);

        attachEvaluationListeners(
          block,
          note.nota_id,
          note.version,
          (notaId, version, vote, comment) => registrarEvaluacion({
            notaId: notaId,
            version: version,
            vote: vote,
            comentario: comment || null,
            source: 'lectura',
            scopeEl: this.controls
          }),
          () => this.handleVoteSuccess(note.nota_id)
        );
      }

      if (this.nextButton) {
        this.nextButton.hidden = true;
        this.nextButton.disabled = false;
      }

      this.setStatus('');
    }

    async showAnotherNote() {
      this.setLoadingState(true);
      const nextNote = this.pickNextNote();

      if (!nextNote) {
        this.showFallback('Ya evaluaste todas las notas activas en esta sesion.');
        this.setLoadingState(false);
        return;
      }

      this.renderNote(nextNote);
      this.setLoadingState(false);
    }

    async init() {
      if (!this.card || !this.noteText || !this.controls) return;
      if (this.card.dataset.homeEvalReady === 'true') return;
      this.card.dataset.homeEvalReady = 'true';

      if (this.nextButton) {
        this.nextButton.addEventListener('click', () => {
          void this.showAnotherNote();
        });
      }

      try {
        const sessionReady = await this.ensureSession();
        if (!sessionReady) {
          this.showFallback('No se pudo abrir la sesion de participacion.');
          return;
        }

        await this.loadNotes();
        await this.loadEvaluatedNoteIds();

        if (!this.notes.length) {
          this.showFallback('No hay notas activas para mostrar en el inicio.');
          return;
        }

        await this.showAnotherNote();
      } catch (_error) {
        this.showFallback('No se pudieron cargar las notas del home.');
      }
    }
  }

  function initEvaluationCard(grid) {
    const card = grid.querySelector(EVAL_CARD_SELECTOR);
    if (!card) return;

    const evaluator = new HomeEvaluationCard(card);
    void evaluator.init();
  }

  function initHomeExploreGrid() {
    const grid = document.querySelector(GRID_SELECTOR);
    if (!grid || grid.dataset.homeGridReady === 'true') return;

    grid.dataset.homeGridReady = 'true';

    initImageRotator(grid);
    initEvaluationCard(grid);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeExploreGrid, { once: true });
  } else {
    initHomeExploreGrid();
  }
})();
