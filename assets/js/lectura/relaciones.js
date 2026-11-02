// relaciones.js — Relaciones imagen-texto (relaciones.xml) en la sala de lectura.
// Cada <relation name="representa"> enlaza un objeto de la colección (active,
// "cb:<objectid>") con los pasajes que representa (passive, "fo:<xml:id>" ya
// expandidos). El archivo lo genera fuenteovejuna-data y puede no existir.
// A diferencia de una nota, la imagen no subraya el texto: acompaña la lectura.
// Cada relación se señala con un icono al margen de su primer pasaje y su rango
// solo se resalta mientras se consulta (pasar el ratón, panel abierto).

import {
  findElementByXmlId,
  loadCbMetadataIndex,
  buildCbThumbLinkHtml,
  buildCbTextLinkHtml
} from './notas-dom.js';

var RELATION_NAME = 'representa';
var MARKER_LABEL = 'Imágenes relacionadas con este pasaje';
var CERT_LABELS = {
  proposed: 'Identificación propuesta',
  low: 'Identificación dudosa'
};

function splitPointers(value, prefix) {
  var pattern = new RegExp('^' + prefix + ':', 'i');
  return String(value == null ? '' : value)
    .split(/\s+/)
    .filter(function (token) { return pattern.test(token); })
    .map(function (token) { return token.replace(pattern, '').trim(); })
    .filter(Boolean);
}

// Devuelve las relaciones en orden de archivo:
// [{ id, objectIds, passageIds, cert, elements, anchor }]. elements y anchor
// (el primer pasaje en el texto) los rellena resolveRelations.
function parseRelacionesDoc(doc) {
  var list = [];
  if (!doc || typeof doc.getElementsByTagNameNS !== 'function') return list;

  var relations = doc.getElementsByTagNameNS('*', 'relation');
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    if (relation.getAttribute('name') !== RELATION_NAME) continue;
    var objectIds = splitPointers(relation.getAttribute('active'), 'cb');
    var passageIds = splitPointers(relation.getAttribute('passive'), 'fo');
    if (objectIds.length === 0 || passageIds.length === 0) continue;
    list.push({
      id: 'rel-' + list.length,
      objectIds: objectIds,
      passageIds: passageIds,
      cert: String(relation.getAttribute('cert') || '').trim().toLowerCase(),
      elements: [],
      anchor: null
    });
  }
  return list;
}

// Carga relaciones.xml si la página declara su URL; si no, resuelve null.
function loadRelacionesDoc(url) {
  if (!url) return Promise.resolve(null);
  return fetch(url)
    .then(function (response) {
      if (!response.ok) return null;
      return response.text();
    })
    .then(function (str) {
      if (!str) return null;
      var doc = new DOMParser().parseFromString(str, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length > 0) {
        console.warn('relaciones.xml no es XML válido; se ignora.');
        return null;
      }
      return doc;
    })
    .catch(function (error) {
      console.warn('No se pudo cargar relaciones.xml:', error);
      return null;
    });
}

// Resuelve los pasajes de cada relación en el texto y calcula su ancla: el
// primer pasaje según el orden del documento, sea verso, acotación o personaje.
// Descarta las relaciones sin ningún pasaje en el texto.
function resolveRelations(container, relations) {
  var resolved = [];
  (relations || []).forEach(function (relation) {
    var elements = [];
    relation.passageIds.forEach(function (passageId) {
      var element = findElementByXmlId(container, passageId);
      if (!element) {
        console.warn('relaciones.xml: no se encuentra el pasaje', passageId);
      } else if (elements.indexOf(element) === -1) {
        elements.push(element);
      }
    });
    if (elements.length === 0) return;
    relation.elements = sortByDocumentOrder(elements);
    relation.anchor = relation.elements[0];
    resolved.push(relation);
  });
  return resolved;
}

function certLabel(relation) {
  return relation && relation.cert === 'low' ? CERT_LABELS.low : CERT_LABELS.proposed;
}

function countObjects(relations) {
  var seen = [];
  relations.forEach(function (relation) {
    relation.objectIds.forEach(function (id) {
      if (seen.indexOf(id) === -1) seen.push(id);
    });
  });
  return seen.length;
}

// Rango de las relaciones resaltadas por gesto (hover) o porque el panel
// muestra sus imágenes (active). Se dibuja como un filete continuo: una línea
// por tramo de pasajes seguidos, y no un borde por verso.
var rangeState = { hover: [], active: [] };
var RANGE_LINE_OFFSET = 9;
var RANGE_GAP_EM = 2.5;

function sortByDocumentOrder(elements) {
  return elements.sort(function (a, b) {
    if (a === b) return 0;
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

// Tramos {left, top, bottom} en coordenadas del contenedor. Dos pasajes están
// en el mismo tramo si entre ellos hay menos de RANGE_GAP_EM líneas de hueco.
function rangeSegments(container, relations) {
  var elements = [];
  relations.forEach(function (relation) {
    relation.elements.forEach(function (element) {
      if (elements.indexOf(element) === -1) elements.push(element);
    });
  });
  sortByDocumentOrder(elements);

  var origin = container.getBoundingClientRect();
  var segments = [];
  var current = null;
  elements.forEach(function (element) {
    var rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    var left = rect.left - origin.left;
    var top = rect.top - origin.top;
    var bottom = rect.bottom - origin.top;
    var gap = parseFloat(window.getComputedStyle(element).fontSize) * RANGE_GAP_EM;
    if (current && top - current.bottom <= gap) {
      current.bottom = Math.max(current.bottom, bottom);
      current.left = Math.min(current.left, left);
    } else {
      current = { left: left, top: top, bottom: bottom };
      segments.push(current);
    }
  });
  return segments;
}

function renderRangeLines(container) {
  if (!container) return;
  Array.from(container.querySelectorAll(':scope > .relation-range-line')).forEach(function (line) {
    line.remove();
  });
  ['hover', 'active'].forEach(function (kind) {
    if (rangeState[kind].length === 0) return;
    rangeSegments(container, rangeState[kind]).forEach(function (segment) {
      var line = document.createElement('span');
      line.className = 'relation-range-line relation-range-line--' + kind;
      line.setAttribute('aria-hidden', 'true');
      line.style.left = Math.max(0, segment.left - RANGE_LINE_OFFSET) + 'px';
      line.style.top = segment.top + 'px';
      line.style.height = Math.max(0, segment.bottom - segment.top) + 'px';
      container.appendChild(line);
    });
  });
}

// kind: 'hover' (gesto) o 'active' (mientras el panel muestre sus imágenes);
// son independientes. Sin relaciones, quita el resaltado de ese tipo.
function setRangeHighlight(container, kind, relations) {
  rangeState[kind] = relations || [];
  renderRangeLines(container);
}

// Un icono de imagen al margen del ancla de cada grupo de relaciones. Varias
// relaciones que empiezan en el mismo pasaje comparten icono, con el número de
// imágenes. El icono no lleva texto: no contamina la búsqueda ni la copia.
// onActivate recibe { relations, marker, element, event }.
function applyRelationMarkers(container, relations, options) {
  if (!container || !relations || relations.length === 0) return [];
  var onActivate = options && options.onActivate;

  var groups = new Map();
  relations.forEach(function (relation) {
    var list = groups.get(relation.anchor) || [];
    list.push(relation);
    groups.set(relation.anchor, list);
  });

  // El filete se coloca respecto al contenedor y se recalcula si el texto se
  // recoloca (panel, tamaño de letra, ventana).
  container.classList.add('relation-lines-host');
  if (typeof ResizeObserver === 'function' && !container.hasAttribute('data-relation-lines')) {
    container.setAttribute('data-relation-lines', 'true');
    new ResizeObserver(function () { renderRangeLines(container); }).observe(container);
  }

  var markers = [];
  groups.forEach(function (group, element) {
    var count = countObjects(group);
    var marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'relation-marker';
    marker.setAttribute('aria-label', MARKER_LABEL + (count > 1 ? ' (' + count + ')' : ''));
    marker.setAttribute('aria-pressed', 'false');
    if (count > 1) marker.setAttribute('data-count', String(count));
    marker.setAttribute('data-relation-ids', group.map(function (relation) { return relation.id; }).join(' '));

    var highlightOn = function () { setRangeHighlight(container, 'hover', group); };
    var highlightOff = function () { setRangeHighlight(container, 'hover', []); };
    marker.addEventListener('mouseenter', highlightOn);
    marker.addEventListener('mouseleave', highlightOff);
    marker.addEventListener('focus', highlightOn);
    marker.addEventListener('blur', highlightOff);
    marker.addEventListener('click', function (event) {
      // El pasaje puede tener una nota: el icono no debe abrirla.
      event.preventDefault();
      event.stopPropagation();
      if (onActivate) onActivate({ relations: group, marker: marker, element: element, event: event });
    });

    element.classList.add('relation-anchor');
    // Primer hijo: en pantallas estrechas el icono queda al inicio de la línea.
    element.insertBefore(marker, element.firstChild);
    markers.push(marker);
  });

  return markers;
}

// Marca como pulsados los iconos cuyas relaciones se muestran en el panel.
function setActiveMarkers(container, relations) {
  var ids = (relations || []).map(function (relation) { return relation.id; });
  Array.from(container.querySelectorAll('.relation-marker')).forEach(function (marker) {
    var own = String(marker.getAttribute('data-relation-ids') || '').split(' ').filter(Boolean);
    var active = own.length > 0 && own.every(function (id) { return ids.indexOf(id) !== -1; });
    marker.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

// Relaciones que afectan a unos elementos del texto: las de cada elemento, sus
// antepasados y sus descendientes.
function collectRelationsForElements(container, elements, relations) {
  var result = [];
  if (!relations || relations.length === 0) return result;

  (elements || []).forEach(function (element) {
    relations.forEach(function (relation) {
      if (result.indexOf(relation) !== -1) return;
      var hit = false;
      for (var node = element; node && node !== container && !hit; node = node.parentElement) {
        hit = relation.elements.indexOf(node) !== -1;
      }
      if (!hit) {
        hit = relation.elements.some(function (target) { return element.contains(target); });
      }
      if (hit) result.push(relation);
    });
  });

  return result;
}

// Objetos que una nota ya cita con <ref target="cb:...">.
function collectCitedObjectIds(noteNode) {
  var cited = [];
  if (!noteNode || typeof noteNode.getElementsByTagName !== 'function') return cited;
  var all = noteNode.getElementsByTagName('*');
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].localName || '').toLowerCase() !== 'ref') continue;
    splitPointers(all[i].getAttribute('target'), 'cb').forEach(function (id) {
      if (cited.indexOf(id) === -1) cited.push(id);
    });
  }
  return cited;
}

// Añade al host las imágenes de unas relaciones, con la misma presentación que
// los objetos citados en las notas y, sobre cada relación, si la identificación
// es propuesta o dudosa. Se omiten los objetos que ya cita la nota (excludedIds),
// los repetidos y los que no están en metadata.json. isCurrent() permite
// descartar el resultado si el panel ha cambiado mientras se cargaba la metadata.
async function renderRelatedObjects(host, relations, isCurrent, excludedIds) {
  if (!host || !Array.isArray(relations) || relations.length === 0) return false;

  var index;
  try {
    index = await loadCbMetadataIndex();
  } catch (error) {
    console.warn('No se pudo cargar metadata.json para los objetos relacionados:', error);
    return false;
  }
  if (typeof isCurrent === 'function' && !isCurrent()) return false;

  var shown = (excludedIds || []).slice();
  var blocks = [];
  relations.forEach(function (relation) {
    var items = [];
    relation.objectIds.forEach(function (objectId) {
      if (shown.indexOf(objectId) !== -1) return;
      var item = index[objectId];
      if (!item) {
        console.warn('Objeto relacionado sin ficha en metadata.json:', objectId);
        return;
      }
      var html = buildCbThumbLinkHtml(objectId, item) || buildCbTextLinkHtml(objectId, item);
      if (!html) return;
      shown.push(objectId);
      items.push(html);
    });
    if (items.length === 0) return;
    blocks.push(
      '<div class="note-relation" data-relation-id="' + relation.id + '">' +
        '<p class="note-relation-status">' + certLabel(relation) + '</p>' +
        '<div class="note-rich-text">' + items.join('') + '</div>' +
      '</div>'
    );
  });
  if (blocks.length === 0) return false;

  var section = document.createElement('section');
  section.className = 'note-related-objects';
  section.innerHTML =
    '<h3 class="note-related-objects-title">Objetos de la colección</h3>' + blocks.join('');
  host.appendChild(section);
  return true;
}

export {
  parseRelacionesDoc,
  loadRelacionesDoc,
  resolveRelations,
  applyRelationMarkers,
  setActiveMarkers,
  setRangeHighlight,
  collectRelationsForElements,
  collectCitedObjectIds,
  renderRelatedObjects
};
