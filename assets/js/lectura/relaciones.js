// relaciones.js — Relaciones imagen-texto (relaciones.xml) en la sala de lectura.
// Cada <relation name="representa"> enlaza un objeto de la colección (active,
// "cb:<objectid>") con los pasajes que representa (passive, "fo:<xml:id>" ya
// expandidos). El archivo lo genera fuenteovejuna-data y puede no existir.

import {
  findElementByXmlId,
  loadCbMetadataIndex,
  buildCbThumbLinkHtml,
  buildCbTextLinkHtml
} from './notas-dom.js';

var RELATION_NAME = 'representa';

function splitPointers(value, prefix) {
  var pattern = new RegExp('^' + prefix + ':', 'i');
  return String(value == null ? '' : value)
    .split(/\s+/)
    .filter(function (token) { return pattern.test(token); })
    .map(function (token) { return token.replace(pattern, '').trim(); })
    .filter(Boolean);
}

// Devuelve un Map xml:id del pasaje -> [objectid, ...] en orden de aparición.
function parseRelacionesDoc(doc) {
  var map = new Map();
  if (!doc || typeof doc.getElementsByTagNameNS !== 'function') return map;

  var relations = doc.getElementsByTagNameNS('*', 'relation');
  for (var i = 0; i < relations.length; i++) {
    var relation = relations[i];
    if (relation.getAttribute('name') !== RELATION_NAME) continue;
    var objectIds = splitPointers(relation.getAttribute('active'), 'cb');
    var passageIds = splitPointers(relation.getAttribute('passive'), 'fo');

    passageIds.forEach(function (passageId) {
      var list = map.get(passageId) || [];
      objectIds.forEach(function (objectId) {
        if (list.indexOf(objectId) === -1) list.push(objectId);
      });
      map.set(passageId, list);
    });
  }
  return map;
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

function readRelationIds(wrapper) {
  return String(wrapper && wrapper.getAttribute('data-cb-relations') || '')
    .split(' ')
    .filter(Boolean);
}

// Envoltorio del pasaje: reutiliza el de las notas si existe. Si no, crea uno
// propio sin la clase note-wrapper, para no alterar el comportamiento que
// depende de ella (sugerencias, filtros de notas).
function ensureRelationWrapper(element) {
  var first = element.firstElementChild;
  if (first && (first.classList.contains('note-wrapper') || first.classList.contains('relation-wrapper'))) {
    return first;
  }
  var wrapper = document.createElement('span');
  wrapper.className = 'relation-wrapper note-target';
  Array.from(element.childNodes).forEach(function (node) { wrapper.appendChild(node); });
  element.appendChild(wrapper);
  return wrapper;
}

// Marca en el texto los pasajes con objetos relacionados. El icono de imagen
// se pone solo al empezar una serie, para que un rango de versos no lleve uno
// por verso. onWrapperClick recibe { wrapper, element, event }.
function applyRelationHighlights(container, relationMap, options) {
  if (!container || !relationMap || relationMap.size === 0) return [];
  var onWrapperClick = options && options.onWrapperClick;
  var wrappers = [];

  relationMap.forEach(function (objectIds, passageId) {
    var element = findElementByXmlId(container, passageId);
    if (!element) {
      console.warn('relaciones.xml: no se encuentra el pasaje', passageId);
      return;
    }
    var wrapper = ensureRelationWrapper(element);
    var merged = readRelationIds(wrapper);
    objectIds.forEach(function (objectId) {
      if (merged.indexOf(objectId) === -1) merged.push(objectId);
    });
    wrapper.setAttribute('data-cb-relations', merged.join(' '));
    wrapper.classList.add('note-target', 'note-target-has-relations');

    if (onWrapperClick && !wrapper.hasAttribute('data-relation-events')) {
      wrapper.setAttribute('data-relation-events', 'true');
      wrapper.addEventListener('click', function (event) {
        onWrapperClick({ wrapper: wrapper, element: element, event: event });
      });
    }
    wrappers.push(wrapper);
  });

  var previous = [];
  Array.from(container.querySelectorAll('[data-cb-relations]')).forEach(function (wrapper) {
    var ids = readRelationIds(wrapper);
    var startsRun = ids.some(function (id) { return previous.indexOf(id) === -1; });
    wrapper.classList.toggle('relation-run-start', startsRun);
    if (startsRun) wrapper.classList.add('note-target-has-media');
    previous = ids;
  });

  return wrappers;
}

// Objetos relacionados con unos elementos del texto: los de cada elemento, sus
// antepasados y sus descendientes con xml:id.
function collectRelatedObjectIds(container, elements, relationMap) {
  var result = [];
  if (!relationMap || relationMap.size === 0) return result;

  function addFor(xmlId) {
    var ids = xmlId ? relationMap.get(xmlId) : null;
    if (!ids) return;
    ids.forEach(function (id) {
      if (result.indexOf(id) === -1) result.push(id);
    });
  }

  (elements || []).forEach(function (element) {
    for (var node = element; node && node !== container; node = node.parentElement) {
      addFor(node.getAttribute && node.getAttribute('xml:id'));
    }
    if (typeof element.querySelectorAll === 'function') {
      element.querySelectorAll('[xml\\:id]').forEach(function (child) {
        addFor(child.getAttribute('xml:id'));
      });
    }
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

// Añade al host la lista de objetos relacionados, con la misma presentación
// que los objetos citados en las notas. Los objetos que no están en
// metadata.json se omiten. isCurrent() permite descartar el resultado si el
// panel ha cambiado mientras se cargaba la metadata.
async function renderRelatedObjects(host, objectIds, isCurrent) {
  if (!host || !Array.isArray(objectIds) || objectIds.length === 0) return false;

  var index;
  try {
    index = await loadCbMetadataIndex();
  } catch (error) {
    console.warn('No se pudo cargar metadata.json para los objetos relacionados:', error);
    return false;
  }
  if (typeof isCurrent === 'function' && !isCurrent()) return false;

  var items = objectIds
    .map(function (objectId) {
      var item = index[objectId];
      if (!item) {
        console.warn('Objeto relacionado sin ficha en metadata.json:', objectId);
        return '';
      }
      return buildCbThumbLinkHtml(objectId, item) || buildCbTextLinkHtml(objectId, item);
    })
    .filter(Boolean);
  if (items.length === 0) return false;

  var section = document.createElement('section');
  section.className = 'note-related-objects';
  section.innerHTML =
    '<h3 class="note-related-objects-title">Objetos de la colección</h3>' +
    '<div class="note-rich-text">' + items.join('') + '</div>';
  host.appendChild(section);
  return true;
}

export {
  parseRelacionesDoc,
  loadRelacionesDoc,
  applyRelationHighlights,
  collectRelatedObjectIds,
  collectCitedObjectIds,
  renderRelatedObjects
};
