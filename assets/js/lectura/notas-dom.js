// notas-dom.js — Utilidades compartidas para manipulación DOM de notas
// en contenedores TEI (CETEIcean). Usado por sala-de-lectura.js y laboratorio.js.

import {
  renderNoteDisplay as renderSharedNoteDisplay
} from '../shared/note-panel.js';

var TIPO_NOTA_MAP = {
  lexica: 'léxica', parafrasis: 'paráfrasis', historica: 'histórica',
  geografica: 'geográfica', mitologica: 'mitológica', estilistica: 'estilística',
  escenica: 'escénica', ecdotica: 'ecdótica', realia: 'realia',
  dramaturgica: 'dramatúrgica', intertextual: 'intertextual'
};

var TIPO_NOTA_ORDER = [
  'lexica', 'parafrasis', 'realia', 'historica', 'geografica', 'mitologica',
  'intertextual', 'estilistica', 'ecdotica', 'dramaturgica', 'escenica'
];

var TIPO_NOTA_DESC_MAP = {
  lexica: 'Glosa léxica, semántica y fraseológica.',
  parafrasis: 'Reformulación del sentido global o aclaración sintáctica.',
  realia: 'Cultura material, usos e instituciones presupuestas.',
  historica: 'Personajes, hechos y cronología relevantes.',
  geografica: 'Identificación e interpretación de lugares.',
  mitologica: 'Tradición clásica, bíblica y hagiográfica.',
  intertextual: 'Fuentes, paralelos, tópicos, motivos y tradición popular.',
  estilistica: 'Figuras, juegos de palabras y recursos expresivos.',
  ecdotica: 'Variantes y decisiones de fijación textual.',
  dramaturgica: 'Acción, conflicto, función del parlamento y estructura escénica.',
  escenica: 'Representación, gesto, movimiento y acotación implícita.'
};

var CB_METADATA_URL = new URL('../../data/metadata.json', import.meta.url).toString();
var cbMetadataIndexPromise = null;

function escapeHtmlAttribute(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeAnaCategories(value) {
  var source = Array.isArray(value)
    ? value
    : String(value == null ? '' : value).split(/\s+/);
  var seen = Object.create(null);
  var categories = [];

  source.forEach(function (entry) {
    var token = String(entry == null ? '' : entry).trim().replace(/^#/, '');
    if (!token || seen[token]) return;
    seen[token] = true;
    categories.push(token);
  });

  return categories;
}

function buildNoteBadgeHTML(kind, value) {
  if (!value) return '';

  var label = TIPO_NOTA_MAP[value] || value;
  var description = TIPO_NOTA_DESC_MAP[value] || '';
  var tooltipAttrs = description
    ? ' data-tooltip="' + escapeHtmlAttribute(description) + '" aria-label="' + escapeHtmlAttribute(label + '. ' + description) + '"'
    : '';

  return '<span class="note-badge note-badge-' + kind + '" tabindex="0"' + tooltipAttrs + '>' + label + '</span>';
}

function initNoteBadgeTooltip() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__noteBadgeTooltipState) return;

  var tooltipId = 'note-badge-tooltip';
  var offsetPx = 10;
  var viewportGutter = 12;
  var state = {
    tooltipEl: null,
    activeBadge: null
  };

  function ensureTooltip() {
    if (state.tooltipEl && document.body.contains(state.tooltipEl)) return state.tooltipEl;

    var tooltipEl = document.getElementById(tooltipId);
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = tooltipId;
      tooltipEl.className = 'note-badge-tooltip';
      tooltipEl.setAttribute('role', 'tooltip');
      tooltipEl.setAttribute('aria-hidden', 'true');
      tooltipEl.hidden = true;
      document.body.appendChild(tooltipEl);
    }

    state.tooltipEl = tooltipEl;
    return tooltipEl;
  }

  function positionTooltip(badge, tooltipEl) {
    if (!badge || !tooltipEl) return;

    var rect = badge.getBoundingClientRect();
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    var tooltipRect = tooltipEl.getBoundingClientRect();
    var placeAbove = rect.top >= tooltipRect.height + offsetPx + viewportGutter;
    var placement = placeAbove ? 'top' : 'bottom';
    var left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    var minLeft = viewportGutter;
    var maxLeft = Math.max(viewportGutter, viewportWidth - tooltipRect.width - viewportGutter);

    left = Math.min(Math.max(left, minLeft), maxLeft);

    var top = placement === 'top'
      ? rect.top - tooltipRect.height - offsetPx
      : rect.bottom + offsetPx;

    var maxTop = Math.max(viewportGutter, viewportHeight - tooltipRect.height - viewportGutter);
    top = Math.min(Math.max(top, viewportGutter), maxTop);

    tooltipEl.style.left = Math.round(left) + 'px';
    tooltipEl.style.top = Math.round(top) + 'px';
    tooltipEl.setAttribute('data-placement', placement);

    var arrowLeft = (rect.left + (rect.width / 2)) - left;
    var arrowSafeLeft = Math.min(
      Math.max(arrowLeft, 12),
      Math.max(12, tooltipRect.width - 12)
    );
    tooltipEl.style.setProperty('--note-badge-tooltip-arrow-left', Math.round(arrowSafeLeft) + 'px');
  }

  function hideTooltip() {
    var tooltipEl = ensureTooltip();
    if (state.activeBadge) {
      state.activeBadge.removeAttribute('aria-describedby');
    }

    state.activeBadge = null;
    tooltipEl.hidden = true;
    tooltipEl.textContent = '';
    tooltipEl.setAttribute('aria-hidden', 'true');
    tooltipEl.removeAttribute('data-placement');
    tooltipEl.style.removeProperty('left');
    tooltipEl.style.removeProperty('top');
    tooltipEl.style.removeProperty('--note-badge-tooltip-arrow-left');
  }

  function showTooltip(badge) {
    if (!badge || !badge.matches('.note-badge[data-tooltip]')) return;

    var description = badge.getAttribute('data-tooltip');
    if (!description) {
      hideTooltip();
      return;
    }

    var tooltipEl = ensureTooltip();
    if (state.activeBadge && state.activeBadge !== badge) {
      state.activeBadge.removeAttribute('aria-describedby');
    }

    state.activeBadge = badge;
    tooltipEl.textContent = description;
    tooltipEl.hidden = false;
    tooltipEl.setAttribute('aria-hidden', 'false');
    badge.setAttribute('aria-describedby', tooltipId);
    positionTooltip(badge, tooltipEl);
  }

  function resolveBadge(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('.note-badge[data-tooltip]');
  }

  function handleMouseOver(event) {
    var badge = resolveBadge(event.target);
    if (!badge) return;

    var fromBadge = resolveBadge(event.relatedTarget);
    if (fromBadge === badge) return;
    showTooltip(badge);
  }

  function handleMouseOut(event) {
    var badge = resolveBadge(event.target);
    if (!badge) return;

    var toBadge = resolveBadge(event.relatedTarget);
    if (toBadge === badge) return;
    if (state.activeBadge === badge) hideTooltip();
  }

  function handleFocusIn(event) {
    var badge = resolveBadge(event.target);
    if (!badge) return;
    showTooltip(badge);
  }

  function handleFocusOut(event) {
    var badge = resolveBadge(event.target);
    if (!badge) return;

    var nextBadge = resolveBadge(event.relatedTarget);
    if (nextBadge === badge) return;
    if (state.activeBadge === badge) hideTooltip();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && state.activeBadge) {
      hideTooltip();
    }
  }

  function handleViewportChange() {
    if (state.activeBadge) hideTooltip();
  }

  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('focusin', handleFocusIn);
  document.addEventListener('focusout', handleFocusOut);
  document.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('scroll', handleViewportChange, true);

  window.__noteBadgeTooltipState = state;
}

function sanitizeNoteHtml(html) {
  var rawHtml = String(html == null ? '' : html);
  var hasPurify = window.DOMPurify && typeof window.DOMPurify.sanitize === 'function';
  if (!hasPurify) return rawHtml;

  return window.DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['term', 'em', 'strong', 'i', 'b', 'a', 'img', 'figure', 'figcaption', 'br', 'span'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'loading', 'decoding', 'data-cb-objectid', 'target', 'rel']
  });
}

function setNoteRichText(target, html) {
  if (!target) return;
  target.innerHTML = sanitizeNoteHtml(html);
}

function buildItemHrefFromObjectId(objectId) {
  return '/items/' + encodeURIComponent(String(objectId || '').trim()) + '.html';
}

function normalizeRelativeHref(href) {
  var value = String(href || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.charAt(0) === '/') return value;
  return '/' + value.replace(/^\/+/, '');
}

function pickCbItemHref(item, objectId) {
  if (item) {
    var referenceUrl = normalizeRelativeHref(item.reference_url);
    if (referenceUrl) return referenceUrl;
  }
  return buildItemHrefFromObjectId(objectId);
}

function pickCbItemThumb(item) {
  if (!item) return '';
  var candidate = String(
    item.object_thumb
    || item.image_thumb
    || item.image_small
    || ''
  ).trim();
  return candidate;
}

function loadCbMetadataIndex() {
  if (cbMetadataIndexPromise) return cbMetadataIndexPromise;

  cbMetadataIndexPromise = fetch(CB_METADATA_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('No se pudo cargar metadata JSON (' + response.status + ')');
      }
      return response.json();
    })
    .then(function (payload) {
      var rows = Array.isArray(payload)
        ? payload
        : (payload && Array.isArray(payload.objects) ? payload.objects : []);
      var index = Object.create(null);

      rows.forEach(function (row) {
        var objectId = String(row && row.objectid ? row.objectid : '').trim();
        if (!objectId) return;
        index[objectId] = row;
      });

      return index;
    })
    .catch(function (error) {
      cbMetadataIndexPromise = null;
      throw error;
    });

  return cbMetadataIndexPromise;
}

function buildCbThumbLinkHtml(objectId, item) {
  var href = pickCbItemHref(item, objectId);
  var thumb = pickCbItemThumb(item);
  if (!thumb) return '';

  var title = String(item && item.title ? item.title : objectId).trim();
  var alt = String(item && (item.image_alt_text || item.description || item.title) ? (item.image_alt_text || item.description || item.title) : ('Miniatura de ' + objectId)).trim();

  return '<a class="note-cb-thumb-link" href="' + escapeHtmlAttribute(href) + '">' +
    '<img class="note-cb-auto-thumb img-thumbnail" src="' + escapeHtmlAttribute(thumb) + '" alt="' + escapeHtmlAttribute(alt) + '" loading="lazy" decoding="async">' +
    '<span class="note-cb-thumb-caption">Abrir ficha: ' + escapeHtmlAttribute(title) + '</span>' +
  '</a>';
}

async function hydrateCbRefsInContainer(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return;
  var slots = Array.from(container.querySelectorAll('.note-rich-text .note-cb-slot[data-cb-objectid]'));
  var legacyLinks = Array.from(container.querySelectorAll('.note-rich-text a.note-cb-link[data-cb-objectid]'));
  if (slots.length === 0 && legacyLinks.length === 0) return;

  var index = null;
  try {
    index = await loadCbMetadataIndex();
  } catch (error) {
    // Si no hay metadata, mantenemos enlaces fallback a /items/<id>.html
    index = Object.create(null);
  }

  function injectThumbAtNode(node, removeNodeAfterInject) {
    var objectId = String(node.getAttribute('data-cb-objectid') || '').trim();
    if (!objectId) return;
    if (node.nextElementSibling && node.nextElementSibling.classList.contains('note-cb-thumb-link')) {
      if (removeNodeAfterInject) node.remove();
      return;
    }

    var item = index ? index[objectId] : null;
    var thumbHtml = buildCbThumbLinkHtml(objectId, item);
    if (!thumbHtml) return;
    node.insertAdjacentHTML('afterend', thumbHtml);
    if (removeNodeAfterInject) node.remove();
  }

  slots.forEach(function (slot) { injectThumbAtNode(slot, true); });
  legacyLinks.forEach(function (link) { injectThumbAtNode(link, true); });
}

// Parsear target TEI y normalizar punteros:
// "#seg-1 #l-5" => ['seg-1', 'l-5']
// "fo:seg-1 fo:l-5" => ['seg-1', 'l-5']
// "fuenteovejuna.xml#seg-1" => ['seg-1']
function normalizeTargetToken(token) {
  var value = (token || '').toString().trim();
  if (!value) return '';
  if (value.indexOf('#') !== -1) return value.slice(value.lastIndexOf('#') + 1).trim();
  if (/^[A-Za-z][A-Za-z0-9+.-]*:[^/].*$/.test(value)) return value.slice(value.indexOf(':') + 1).trim();
  return value.replace(/^#/, '');
}

function parseTargetString(targetAttr) {
  if (!targetAttr) return [];
  return targetAttr.split(/\s+/).map(normalizeTargetToken).filter(function (t) { return t; });
}

// Resolver variantes de ids de verso: l-59a <-> l-59-a
function buildXmlIdCandidates(xmlId) {
  var id = normalizeTargetToken(xmlId);
  if (!id) return [];

  var candidates = [id];
  var compactLine = /^l-(\d+)([a-z])$/i.exec(id);
  if (compactLine) {
    candidates.push('l-' + compactLine[1] + '-' + compactLine[2].toLowerCase());
  }

  var dashedLine = /^l-(\d+)-([a-z])$/i.exec(id);
  if (dashedLine) {
    candidates.push('l-' + dashedLine[1] + dashedLine[2].toLowerCase());
  }

  return Array.from(new Set(candidates));
}

// Buscar elemento por xml:id (CSS selector + fallback lineal)
function findElementByXmlId(container, xmlId) {
  if (!container || !xmlId) return null;

  var candidates = buildXmlIdCandidates(xmlId);
  for (var c = 0; c < candidates.length; c++) {
    var candidate = candidates[c];
    var el = container.querySelector('[xml\\:id="' + candidate + '"]');
    if (el) return el;
  }

  var all = container.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var currentId = all[i].getAttribute('xml:id');
    if (!currentId) continue;
    for (var j = 0; j < candidates.length; j++) {
      if (currentId === candidates[j]) return all[i];
    }
  }
  return null;
}

// Parsear target string y resolver todos los elementos referenciados
function resolveTargetElements(container, targetAttr) {
  var ids = parseTargetString(targetAttr);
  var elements = [];
  for (var i = 0; i < ids.length; i++) {
    var el = findElementByXmlId(container, ids[i]);
    if (el) elements.push(el);
  }
  return elements;
}

function noteElementHasGraphic(noteElement) {
  if (!noteElement || typeof noteElement.getElementsByTagName !== 'function') return false;
  var all = noteElement.getElementsByTagName('*');
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].localName || '').toLowerCase() === 'graphic') return true;
  }
  return false;
}

function noteHasImageContent(note) {
  if (!note) return false;
  if (typeof note.querySelector === 'function') {
    if (noteElementHasGraphic(note)) return true;
    var xmlRefs = note.getElementsByTagName ? note.getElementsByTagName('*') : [];
    for (var i = 0; i < xmlRefs.length; i++) {
      var localName = String(xmlRefs[i].localName || '').toLowerCase();
      if (localName !== 'ref') continue;
      var target = String(xmlRefs[i].getAttribute('target') || '').trim();
      if (/^cb:/i.test(target)) return true;
    }
  }
  if (typeof note.texto_nota === 'string' && /<img[\s>]/i.test(note.texto_nota)) return true;
  if (typeof note.texto_nota === 'string' && /(data-cb-objectid=|href\s*=\s*["']cb:)/i.test(note.texto_nota)) return true;
  return false;
}

// Ordenar notas por especificidad: seg-targets primero, luego por cantidad de targets
function sortNotesBySpecificity(notes, getTarget) {
  return notes.slice().sort(function (a, b) {
    var tA = getTarget(a) || '', tB = getTarget(b) || '';
    var aS = tA.includes('seg-'), bS = tB.includes('seg-');
    if (aS && !bS) return -1;
    if (!aS && bS) return 1;
    return tA.split(/\s+/).length - tB.split(/\s+/).length;
  });
}

function buildDocumentOrderIndex(container) {
  var orderMap = new Map();
  if (!container) return orderMap;
  var all = container.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    orderMap.set(all[i], i);
  }
  return orderMap;
}

function orderNoteMetaByReadingPosition(metaList) {
  return metaList.slice().sort(function (a, b) {
    if (a.firstDocIndex !== b.firstDocIndex) return a.firstDocIndex - b.firstDocIndex;
    if (a.lastDocIndex !== b.lastDocIndex) return a.lastDocIndex - b.lastDocIndex;
    if (a.targetCount !== b.targetCount) return a.targetCount - b.targetCount;
    return a.xmlOrder - b.xmlOrder;
  });
}

function collectNoteTargetMeta(container, notes, options) {
  var getTarget = options.getTarget, getNoteId = options.getNoteId;
  var orderMap = buildDocumentOrderIndex(container);
  var metaById = {};

  notes.forEach(function (note, xmlOrder) {
    var noteId = getNoteId(note);
    var targetStr = getTarget(note);
    if (!noteId || !targetStr) return;

    var parsedTargets = parseTargetString(targetStr);
    var elements = resolveTargetElements(container, targetStr);
    if (elements.length === 0) return;

    var indices = elements
      .map(function (element) { return orderMap.get(element); })
      .filter(function (index) { return typeof index === 'number' && Number.isFinite(index); });

    if (indices.length === 0) return;

    var firstDocIndex = Math.min.apply(Math, indices);
    var lastDocIndex = Math.max.apply(Math, indices);

    metaById[noteId] = {
      noteId: noteId,
      targetStr: targetStr,
      elements: elements,
      xmlOrder: xmlOrder,
      firstDocIndex: firstDocIndex,
      lastDocIndex: lastDocIndex,
      targetCount: parsedTargets.length,
      spanSize: lastDocIndex - firstDocIndex,
      readingOrderIndex: -1
    };
  });

  var orderedMeta = orderNoteMetaByReadingPosition(Object.values(metaById));
  orderedMeta.forEach(function (meta, readingOrderIndex) {
    meta.readingOrderIndex = readingOrderIndex;
  });

  return metaById;
}

function buildReadingOrderNoteIds(container, notes, options) {
  var metaById = options && options.metaById
    ? options.metaById
    : collectNoteTargetMeta(container, notes, options);

  return orderNoteMetaByReadingPosition(Object.values(metaById)).map(function (meta) {
    return meta.noteId;
  });
}

function pickPrimaryNoteIdForClick(groups, metaById) {
  if (!Array.isArray(groups) || groups.length === 0) return null;
  if (groups.length === 1) return groups[0] || null;

  var candidates = groups
    .map(function (groupId) { return metaById && metaById[groupId] ? metaById[groupId] : null; })
    .filter(function (meta) { return !!meta; })
    .sort(function (a, b) {
      if (a.spanSize !== b.spanSize) return a.spanSize - b.spanSize;
      if (a.targetCount !== b.targetCount) return a.targetCount - b.targetCount;
      if (a.readingOrderIndex !== b.readingOrderIndex) return a.readingOrderIndex - b.readingOrderIndex;
      return a.xmlOrder - b.xmlOrder;
    });

  if (candidates.length > 0) {
    return candidates[0].noteId;
  }

  return groups[0] || null;
}

// Asegurar .note-wrapper hijo en elemento TEI. Reutiliza existente.
function ensureNoteWrapper(element) {
  if (element.firstElementChild && element.firstElementChild.classList.contains('note-wrapper')) {
    var existing = element.firstElementChild;
    if (!existing.classList.contains('note-target')) existing.classList.add('note-target');
    return existing;
  }
  var wrapper = document.createElement('span');
  wrapper.className = 'note-wrapper note-target';
  var childNodes = Array.from(element.childNodes);
  for (var i = 0; i < childNodes.length; i++) wrapper.appendChild(childNodes[i]);
  element.appendChild(wrapper);
  return wrapper;
}

// Añadir noteId a data-note-groups. propagateToDescendants: sala usa true, lab false.
function addNoteGroup(wrapper, noteId, options) {
  var propagate = options && options.propagateToDescendants;
  var groups = (wrapper.getAttribute('data-note-groups') || '').split(' ').filter(function (g) { return g; });
  if (groups.indexOf(noteId) !== -1) return;
  groups.push(noteId);
  wrapper.setAttribute('data-note-groups', groups.join(' '));

  if (!propagate) return;
  var children = wrapper.querySelectorAll('.note-wrapper');
  for (var i = 0; i < children.length; i++) {
    var cg = (children[i].getAttribute('data-note-groups') || '').split(' ').filter(function (g) { return g; });
    if (cg.indexOf(noteId) === -1) {
      cg.push(noteId);
      children[i].setAttribute('data-note-groups', cg.join(' '));
    }
  }
}

function addNoteMediaGroup(wrapper, noteId) {
  var groups = (wrapper.getAttribute('data-note-media-groups') || '').split(' ').filter(function (g) { return g; });
  if (groups.indexOf(noteId) !== -1) return;
  groups.push(noteId);
  wrapper.setAttribute('data-note-media-groups', groups.join(' '));
}

function readEffectiveNoteGroups(wrapper) {
  if (!wrapper) return [];
  var attribute = wrapper.hasAttribute('data-visible-note-groups')
    ? 'data-visible-note-groups'
    : 'data-note-groups';
  return (wrapper.getAttribute(attribute) || '').split(' ').filter(function (g) { return g; });
}

// Guard: true si es la primera llamada (adjuntar eventos); false si ya estaban
function markWrapperEventsAttached(wrapper) {
  if (wrapper.hasAttribute('data-note-events')) return false;
  wrapper.setAttribute('data-note-events', 'true');
  return true;
}

function buildNoteBadgesHTML(ana) {
  return normalizeAnaCategories(ana)
    .map(function (category) { return buildNoteBadgeHTML('ana', category); })
    .join('');
}

function buildNoteDisplayHTML(params) {
  var noteId = params.noteId || '',
    noteChange = params.noteChange || '',
    text = params.text || '',
    badges = params.badgesHTML || '';
  var safeText = sanitizeNoteHtml(text);
  return renderSharedNoteDisplay({
    noteId: noteId,
    noteChange: noteChange,
    textHtml: safeText,
    badgesHtml: badges
  });
}

// Toggle .note-active en wrappers que contienen noteId
function highlightNoteInText(container, noteId, active) {
  if (!container || !noteId) return;
  var wrappers = container.querySelectorAll('[data-note-groups*="' + noteId + '"]');
  for (var i = 0; i < wrappers.length; i++) {
    wrappers[i].classList.toggle('note-active', !!active);
  }
}

// Highlight group-aware: activa .note-active en todos los elementos que comparten
// CUALQUIER grupo con el wrapper dado. Usado por sala-de-lectura (mouseenter).
function highlightAllRelatedGroups(container, wrapper, active) {
  if (!container || !wrapper) return;
  var groups = readEffectiveNoteGroups(wrapper);
  if (groups.length === 0) return;
  var all = container.querySelectorAll('[data-note-groups]');
  for (var i = 0; i < all.length; i++) {
    var eg = readEffectiveNoteGroups(all[i]);
    if (groups.some(function (g) { return eg.indexOf(g) !== -1; })) {
      all[i].classList.toggle('note-active', !!active);
    }
  }
}

// Marcar nota como "actual": toggle .note-current + .note-active.
// clearAllActive: lab true (limpia todos), sala false (solo .note-current).
// autoScroll: lab true, sala false.
function markCurrentNoteInText(container, noteId, options) {
  if (!container) return;
  var clearAll = options && options.clearAllActive;
  var scroll = options && options.autoScroll;

  var prev = container.querySelectorAll('.note-current');
  for (var i = 0; i < prev.length; i++) prev[i].classList.remove('note-current', 'note-active');

  if (clearAll) {
    var active = container.querySelectorAll('.note-active');
    for (var j = 0; j < active.length; j++) active[j].classList.remove('note-active');
  }

  if (noteId) {
    var w = container.querySelectorAll('[data-note-groups*="' + noteId + '"]');
    for (var k = 0; k < w.length; k++) w[k].classList.add('note-current', 'note-active');
    if (scroll && w.length > 0) w[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Orquestador: ordena notas, resuelve targets, crea wrappers, adjunta eventos.
// options: { getTarget, getNoteId, propagateGroups, onWrapperClick, onWrapperEnter, onWrapperLeave }
// Los callbacks leen data-note-groups en event-time (no attach-time).
function applyNoteHighlights(container, notes, options) {
  var getTarget = options.getTarget, getNoteId = options.getNoteId;
  var propagate = !!options.propagateGroups;
  var sorted = sortNotesBySpecificity(notes, getTarget);
  var processedIds = [];

  function readGroups(wrapper) {
    return readEffectiveNoteGroups(wrapper);
  }

  sorted.forEach(function (note) {
    var noteId = getNoteId(note), targetStr = getTarget(note);
    var hasImageNote = noteHasImageContent(note);
    if (!targetStr || !noteId) return;
    var elements = resolveTargetElements(container, targetStr);
    if (elements.length === 0) return;
    if (processedIds.indexOf(noteId) === -1) processedIds.push(noteId);

    elements.forEach(function (element) {
      var wrapper = ensureNoteWrapper(element);
      addNoteGroup(wrapper, noteId, { propagateToDescendants: propagate });
      if (hasImageNote) {
        addNoteMediaGroup(wrapper, noteId);
        wrapper.classList.add('note-target-has-media');
      }
      if (!markWrapperEventsAttached(wrapper)) return;

      if (options.onWrapperClick) {
        wrapper.addEventListener('click', function (e) {
          var groups = readGroups(wrapper);
          if (groups.length === 0) return;
          e.preventDefault(); e.stopPropagation();
          options.onWrapperClick({ wrapper: wrapper, groups: groups, event: e });
        });
      }
      if (options.onWrapperEnter) {
        wrapper.addEventListener('mouseenter', function (e) {
          var groups = readGroups(wrapper);
          if (groups.length === 0) return;
          e.stopPropagation();
          options.onWrapperEnter({ wrapper: wrapper, groups: groups, event: e });
        });
      }
      if (options.onWrapperLeave) {
        wrapper.addEventListener('mouseleave', function (e) {
          var groups = readGroups(wrapper);
          if (groups.length === 0) return;
          e.stopPropagation();
          options.onWrapperLeave({ wrapper: wrapper, groups: groups, event: e });
        });
      }
    });
  });

  return processedIds;
}

if (typeof window !== 'undefined') {
  initNoteBadgeTooltip();
}

export {
  TIPO_NOTA_MAP, TIPO_NOTA_DESC_MAP, TIPO_NOTA_ORDER,
  normalizeAnaCategories, parseTargetString, sortNotesBySpecificity,
  collectNoteTargetMeta, buildReadingOrderNoteIds, pickPrimaryNoteIdForClick,
  findElementByXmlId, resolveTargetElements,
  ensureNoteWrapper, addNoteGroup, addNoteMediaGroup, readEffectiveNoteGroups,
  markWrapperEventsAttached,
  buildNoteBadgesHTML, buildNoteDisplayHTML, setNoteRichText, hydrateCbRefsInContainer,
  highlightNoteInText, highlightAllRelatedGroups, initNoteBadgeTooltip,
  markCurrentNoteInText, applyNoteHighlights
};
