// notas-dom.js — Utilidades compartidas para manipulación DOM de notas
// en contenedores TEI (CETEIcean). Usado por sala-de-lectura.js y laboratorio.js.

var TIPO_NOTA_MAP = {
  lexica: 'léxica', parafrasis: 'paráfrasis', historica: 'histórica',
  geografica: 'geográfica', mitologica: 'mitológica', estilistica: 'estilística',
  escenica: 'escénica', ecdotica: 'ecdótica', realia: 'realia'
};

// Parsear target TEI: "#seg-1 #l-5" => ['seg-1', 'l-5']
function parseTargetString(targetAttr) {
  if (!targetAttr) return [];
  return targetAttr.split(/\s+/).map(function (t) { return t.replace('#', ''); }).filter(function (t) { return t; });
}

// Buscar elemento por xml:id (CSS selector + fallback lineal)
function findElementByXmlId(container, xmlId) {
  if (!container || !xmlId) return null;
  var el = container.querySelector('[xml\\:id="' + xmlId + '"]');
  if (el) return el;
  var all = container.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    if (all[i].getAttribute('xml:id') === xmlId) return all[i];
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

// Guard: true si es la primera llamada (adjuntar eventos); false si ya estaban
function markWrapperEventsAttached(wrapper) {
  if (wrapper.hasAttribute('data-note-events')) return false;
  wrapper.setAttribute('data-note-events', 'true');
  return true;
}

function buildNoteBadgesHTML(type, subtype) {
  var html = '';
  if (type) html += '<span class="note-badge note-badge-type">' + (TIPO_NOTA_MAP[type] || type) + '</span>';
  if (subtype) html += '<span class="note-badge note-badge-subtype">' + (TIPO_NOTA_MAP[subtype] || subtype) + '</span>';
  return html;
}

function buildNoteDisplayHTML(params) {
  var noteId = params.noteId || '', text = params.text || '', badges = params.badgesHTML || '';
  return (
    '<div class="note-display" data-note-id="' + noteId + '">' +
      '<div class="note-header">' + (badges ? '<div class="note-badges">' + badges + '</div>' : '') + '</div>' +
      '<p class="fs-6">' + text + '</p>' +
      '<div class="note-footer"></div>' +
    '</div>'
  );
}

function buildSkeletonLoadingHTML() {
  return (
    '<div class="lectura-note-eval-loading" data-eval-loading="true" aria-hidden="true">' +
      '<span class="lectura-skeleton-line is-title"></span>' +
      '<div class="lectura-skeleton-btnrow">' +
        '<span class="lectura-skeleton-btn"></span><span class="lectura-skeleton-btn"></span>' +
      '</div>' +
    '</div>'
  );
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
  var str = wrapper.getAttribute('data-note-groups');
  if (!str) return;
  var groups = str.split(' ').filter(function (g) { return g; });
  var all = container.querySelectorAll('[data-note-groups]');
  for (var i = 0; i < all.length; i++) {
    var eg = (all[i].getAttribute('data-note-groups') || '').split(' ').filter(function (g) { return g; });
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
    return (wrapper.getAttribute('data-note-groups') || '').split(' ').filter(function (g) { return g; });
  }

  sorted.forEach(function (note) {
    var noteId = getNoteId(note), targetStr = getTarget(note);
    if (!targetStr || !noteId) return;
    var elements = resolveTargetElements(container, targetStr);
    if (elements.length === 0) return;
    if (processedIds.indexOf(noteId) === -1) processedIds.push(noteId);

    elements.forEach(function (element) {
      var wrapper = ensureNoteWrapper(element);
      addNoteGroup(wrapper, noteId, { propagateToDescendants: propagate });
      if (!markWrapperEventsAttached(wrapper)) return;

      if (options.onWrapperClick) {
        wrapper.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          options.onWrapperClick({ wrapper: wrapper, groups: readGroups(wrapper), event: e });
        });
      }
      if (options.onWrapperEnter) {
        wrapper.addEventListener('mouseenter', function (e) {
          e.stopPropagation();
          options.onWrapperEnter({ wrapper: wrapper, groups: readGroups(wrapper), event: e });
        });
      }
      if (options.onWrapperLeave) {
        wrapper.addEventListener('mouseleave', function (e) {
          e.stopPropagation();
          options.onWrapperLeave({ wrapper: wrapper, groups: readGroups(wrapper), event: e });
        });
      }
    });
  });

  return processedIds;
}

if (typeof window !== 'undefined') {
  window.TIPO_NOTA_MAP = TIPO_NOTA_MAP;
  window.applyNoteHighlights = applyNoteHighlights;
  window.highlightNoteInText = highlightNoteInText;
  window.highlightAllRelatedGroups = highlightAllRelatedGroups;
  window.markCurrentNoteInText = markCurrentNoteInText;
  window.buildNoteBadgesHTML = buildNoteBadgesHTML;
  window.buildNoteDisplayHTML = buildNoteDisplayHTML;
  window.buildSkeletonLoadingHTML = buildSkeletonLoadingHTML;
}

export {
  TIPO_NOTA_MAP, parseTargetString, sortNotesBySpecificity,
  findElementByXmlId, resolveTargetElements,
  ensureNoteWrapper, addNoteGroup, markWrapperEventsAttached,
  buildNoteBadgesHTML, buildNoteDisplayHTML, buildSkeletonLoadingHTML,
  highlightNoteInText, highlightAllRelatedGroups,
  markCurrentNoteInText, applyNoteHighlights
};
