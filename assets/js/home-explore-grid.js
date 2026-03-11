import {
  crearBotonesConContadores,
  attachEvaluationListeners,
  registrarEvaluacion
} from './participacion/evaluaciones.js';
import {
  applyNoteHighlights,
  markCurrentNoteInText,
  buildNoteBadgesHTML
} from './lectura/notas-dom.js';
import { alignSplitVerses } from './lectura/utils.js';
import { loadStaticNotesWithContext } from './shared/tei-note-context.js';

(function () {
  'use strict';

  const GRID_SELECTOR = '[data-home-grid]';
  const ROTATOR_IMAGE_SELECTOR = '[data-home-rotator-image]';
  const ROTATOR_CARD_SELECTOR = '[data-home-rotator-card]';
  const EVAL_CARD_SELECTOR = '[data-home-eval-card]';

  const ROTATOR_INTERVAL_MS = 4200;
  const ROTATOR_FADE_MS = 180;
  const NOTE_CONTEXT_MAX_VERSES = 9;
  const NOTES_XML_URL = new URL('../data/tei/notas.xml', import.meta.url).toString();
  const TEI_XML_URL = new URL('../data/tei/fuenteovejuna.xml', import.meta.url).toString();

  function toText(value) {
    return String(value == null ? '' : value).trim();
  }

  function parseDelimited(value) {
    return toText(value)
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function shuffleInPlace(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = items[i];
      items[i] = items[j];
      items[j] = temp;
    }
    return items;
  }

  function pickRandom(items) {
    if (!Array.isArray(items) || !items.length) return null;
    const index = Math.floor(Math.random() * items.length);
    return items[index];
  }

  function initImageRotator(image) {
    if (!image || image.dataset.homeRotatorReady === 'true') return;
    image.dataset.homeRotatorReady = 'true';

    const card = image.closest(ROTATOR_CARD_SELECTOR) || image;
    const cardLink = card && card.tagName && card.tagName.toLowerCase() === 'a'
      ? card
      : null;
    const fallbackLink = cardLink ? toText(cardLink.getAttribute('href')) : '';

    const sources = parseDelimited(image.getAttribute('data-rotator-sources'));
    const alts = parseDelimited(image.getAttribute('data-rotator-alts'));
    const links = parseDelimited(image.getAttribute('data-rotator-links'));
    const slides = sources.map((src, index) => ({
      src: src,
      alt: alts[index] || '',
      link: links[index] || fallbackLink
    })).filter((slide) => toText(slide.src) !== '');
    if (slides.length < 2) return;

    shuffleInPlace(slides);
    image.setAttribute('src', slides[0].src);
    if (slides[0].alt) {
      image.setAttribute('alt', slides[0].alt);
    }
    if (cardLink && slides[0].link) {
      cardLink.setAttribute('href', slides[0].link);
    }
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
        const slide = slides[currentIndex];
        image.setAttribute('src', slide.src);
        if (slide.alt) {
          image.setAttribute('alt', slide.alt);
        }
        if (cardLink && slide.link) {
          cardLink.setAttribute('href', slide.link);
        }
        image.classList.remove('is-fading');
      }, ROTATOR_FADE_MS);
    }

    function nextSlide() {
      const nextIndex = (currentIndex + 1) % slides.length;
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

  function initImageRotators(grid) {
    const images = grid.querySelectorAll(ROTATOR_IMAGE_SELECTOR);
    if (!images.length) return;
    images.forEach((image) => initImageRotator(image));
  }

  class HomeEvaluationCard {
    constructor(card) {
      this.card = card;
      this.noteText = card.querySelector('[data-home-note-text]');
      this.noteBadges = card.querySelector('[data-home-note-badges]');
      this.noteBadgesMeta = this.noteBadges ? this.noteBadges.closest('.home-eval-note-meta') : null;
      this.noteContext = card.querySelector('[data-home-note-context]');
      this.controls = card.querySelector('[data-home-eval-controls]');
      this.status = card.querySelector('[data-home-eval-status]');
      this.overlay = card.querySelector('[data-home-eval-overlay]');

      this.notes = [];
      this.evaluatedNoteIds = new Set();
      this.activeNote = null;
      this.countMap = new Map();
      this.versionMap = new Map();
      this.hasEvaluationApi = false;
      this.isEvaluationEnabled = false;
      this.ceteiProcessor = null;
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
    }

    setOverlayVisible(visible) {
      if (!this.overlay) return;
      const shouldShow = !!visible;
      this.overlay.hidden = !shouldShow;
      this.overlay.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
      if (this.card) {
        this.card.classList.toggle('is-overlay-visible', shouldShow);
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

      try {
        await session.init();
      } catch (_error) {
        return false;
      }
      const publicData = session.getPublicSessionData ? session.getPublicSessionData() : null;
      return !!(publicData && publicData.session_id);
    }

    async loadStaticNotes() {
      this.notes = await loadStaticNotesWithContext({
        notesUrl: NOTES_XML_URL,
        teiUrl: TEI_XML_URL,
        maxVerses: NOTE_CONTEXT_MAX_VERSES
      });
    }

    async loadEvaluationMetadata() {
      this.hasEvaluationApi = false;
      this.isEvaluationEnabled = false;
      this.countMap = new Map();
      this.versionMap = new Map();
      this.evaluatedNoteIds = new Set();

      const api = this.getApi();
      if (!api) return;
      this.hasEvaluationApi = true;

      try {
        const [countsResult, activeNotesResult] = await Promise.all([
          api.getNoteEvalCounts(),
          api.getNotasActivas()
        ]);

        if (!countsResult.error && Array.isArray(countsResult.data)) {
          countsResult.data.forEach((row) => {
            const noteId = toText(row.nota_id);
            if (!noteId) return;
            this.countMap.set(noteId, {
              total: Number(row.total || 0),
              utiles: Number(row.utiles || 0),
              mejorables: Number(row.mejorables || 0)
            });
          });
        }

        if (!activeNotesResult.error && Array.isArray(activeNotesResult.data)) {
          activeNotesResult.data.forEach((note) => {
            const noteId = toText(note.nota_id);
            const version = toText(note.version || '1.0');
            if (!noteId) return;
            this.versionMap.set(noteId, version || '1.0');
          });
        }
      } catch (_error) {
        // Supabase opcional: si falla metadata seguimos en modo solo lectura.
      }

      const sessionReady = await this.ensureSession();
      if (!sessionReady) {
        this.isEvaluationEnabled = false;
        return;
      }

      await this.loadEvaluatedNoteIds();
      this.isEvaluationEnabled = true;
    }

    hydrateNotesWithEvalData() {
      this.notes = this.notes.map((note) => ({
        ...note,
        version: this.versionMap.get(note.nota_id) || note.version || '1.0',
        evaluaciones: this.countMap.get(note.nota_id) || note.evaluaciones || { total: 0, utiles: 0, mejorables: 0 }
      }));
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
      const candidates = this.isEvaluationEnabled
        ? this.notes.filter((note) => !this.evaluatedNoteIds.has(note.nota_id))
        : this.notes.slice();
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
      this.setOverlayVisible(false);
      if (this.noteText) {
        this.noteText.textContent = 'No hay una nota lista para evaluar en este momento.';
      }
      if (this.noteContext) {
        this.noteContext.innerHTML = '';
      }
      if (this.noteBadges) {
        this.noteBadges.innerHTML = '';
        this.noteBadges.hidden = true;
      }
      if (this.noteBadgesMeta) {
        this.noteBadgesMeta.hidden = true;
      }
      if (this.controls) {
        this.controls.dataset.evalState = 'idle';
        this.controls.dataset.evalNoteId = '';
        this.controls.innerHTML = '<p class="note-dock-placeholder"></p>';
      }
      this.setStatus(message || 'Abre el laboratorio para seguir evaluando notas.', 'error');
    }

    renderContextFallback(note) {
      if (!this.noteContext) return;
      const items = note && note.context && Array.isArray(note.context.items)
        ? note.context.items
        : [];
      if (!items.length) return;

      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        const line = document.createElement('p');
        line.className = 'home-eval-context-line';
        if (item.kind === 'stage') {
          line.classList.add('is-stage');
          line.textContent = 'Acotacion: ' + toText(item.text);
        } else {
          line.textContent = toText(item.text);
        }
        fragment.appendChild(line);
      });
      this.noteContext.appendChild(fragment);
    }

    getCeteiProcessor() {
      if (this.ceteiProcessor) return this.ceteiProcessor;
      if (typeof window === 'undefined' || typeof window.CETEI !== 'function') return null;
      this.ceteiProcessor = new window.CETEI();
      return this.ceteiProcessor;
    }

    renderContext(note) {
      if (!this.noteContext) return;
      this.noteContext.innerHTML = '';

      const fragmentXml = toText(note && note.context ? note.context.fragment_xml : '');
      const cetei = this.getCeteiProcessor();
      if (!fragmentXml || !cetei) {
        this.renderContextFallback(note);
        return;
      }

      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fragmentXml, 'application/xml');
        if (xmlDoc.querySelector('parsererror')) {
          this.renderContextFallback(note);
          return;
        }

        const rendered = cetei.domToHTML5(xmlDoc);
        if (!rendered) {
          this.renderContextFallback(note);
          return;
        }

        this.noteContext.appendChild(rendered);
        alignSplitVerses(this.noteContext);

        applyNoteHighlights(this.noteContext, [note], {
          getTarget: (entry) => entry.target || '',
          getNoteId: (entry) => entry.nota_id || '',
          propagateGroups: false
        });

        markCurrentNoteInText(this.noteContext, note.nota_id, {
          clearAllActive: true,
          autoScroll: false
        });
      } catch (_error) {
        this.renderContextFallback(note);
      }
    }

    renderReadOnlyControls(block) {
      block.classList.add('is-readonly');
      const buttons = block.querySelectorAll('button');
      buttons.forEach((button) => {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      });
      const textareas = block.querySelectorAll('textarea');
      textareas.forEach((textarea) => {
        textarea.disabled = true;
        textarea.readOnly = true;
      });
      const commentBox = block.querySelector('.evaluacion-comentario');
      if (commentBox) {
        commentBox.style.display = 'none';
      }
    }

    handleVoteSuccess(noteId) {
      this.evaluatedNoteIds.add(noteId);
      if (this.controls) {
        this.controls.dataset.evalState = 'evaluated';
        this.controls.dataset.evalNoteId = noteId;
        this.controls.innerHTML = '<div class="nota-ya-evaluada"><i class="fa-solid fa-check-circle" aria-hidden="true"></i> Nota evaluada</div>';
      }
      this.setStatus('', '');
      this.setOverlayVisible(true);
    }

    renderNote(note) {
      this.activeNote = note;
      this.setOverlayVisible(false);

      if (this.noteText) {
        this.noteText.textContent = toText(note.texto_nota);
      }
      if (this.noteBadges) {
        this.noteBadges.innerHTML = buildNoteBadgesHTML(note.type, note.subtype);
        const hasBadges = this.noteBadges.innerHTML.trim() !== '';
        this.noteBadges.hidden = !hasBadges;
        if (this.noteBadgesMeta) {
          this.noteBadgesMeta.hidden = !hasBadges;
        }
      }

      this.renderContext(note);

      if (!this.controls) {
        if (!this.isEvaluationEnabled) {
          this.setStatus('Lectura disponible. Evaluacion temporalmente no disponible.', '');
        } else {
          this.setStatus('');
        }
        return;
      }

      const block = document.createElement('div');
      block.className = 'nota-evaluacion';
      block.setAttribute('data-note-id', note.nota_id);
      block.innerHTML = crearBotonesConContadores(
        note.nota_id,
        note.version,
        note.evaluaciones || { total: 0, utiles: 0, mejorables: 0 }
      );

      this.controls.innerHTML = '';
      this.controls.dataset.evalState = 'ready';
      this.controls.dataset.evalNoteId = note.nota_id;
      this.controls.appendChild(block);

      if (this.isEvaluationEnabled) {
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
      } else {
        this.renderReadOnlyControls(block);
        const readonlyMessage = document.createElement('p');
        readonlyMessage.className = 'home-eval-readonly';
        readonlyMessage.textContent = 'La evaluacion no esta disponible ahora mismo.';
        this.controls.appendChild(readonlyMessage);
      }

      if (!this.isEvaluationEnabled) {
        this.setStatus('Puedes leer notas y su contexto aunque no haya conexion con participacion.', '');
      } else {
        this.setStatus('');
      }
    }

    async showAnotherNote() {
      this.setLoadingState(true);
      const nextNote = this.pickNextNote();

      if (!nextNote) {
        if (this.isEvaluationEnabled) {
          this.showFallback('Ya evaluaste todas las notas activas en esta sesion.');
        } else {
          this.showFallback('No hay mas notas disponibles para mostrar ahora.');
        }
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
      this.setOverlayVisible(false);

      try {
        this.setLoadingState(true);
        await this.loadStaticNotes();
        await this.loadEvaluationMetadata();
        this.hydrateNotesWithEvalData();

        if (!Array.isArray(this.notes) || !this.notes.length) {
          this.showFallback('No se pudieron preparar notas desde los archivos estaticos.');
          return;
        }

        await this.showAnotherNote();
      } catch (_error) {
        this.showFallback('No se pudieron cargar notas estaticas del proyecto.');
      } finally {
        this.setLoadingState(false);
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

    initImageRotators(grid);
    initEvaluationCard(grid);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeExploreGrid, { once: true });
  } else {
    initHomeExploreGrid();
  }
})();
