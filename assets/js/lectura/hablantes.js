// hablantes.js — Identifica en la lectura los hablantes ambiguos.
// Cada <sp> apunta con @who a una <person> o <personGrp> de la cabecera. La
// etiqueta impresa (<speaker>) se respeta tal cual; si no coincide con el
// nombre de esa persona (REGIDOR frente a «Cuadrado»), la etiqueta se marca con
// un subrayado punteado y un globo con el nombre. El globo es el de las
// insignias de nota (notas-dom.js), que atiende ratón, foco y Escape.

var STORAGE_KEY = 'todosauna:lectura:ambiguous-speakers:v1';
var CERT_LABELS = { medium: 'certeza media', low: 'certeza baja' };

// Sin mayúsculas, tildes ni puntuación de los extremos: COMENDADOR = Comendador.
function normalizeLabel(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

function textOf(element) {
  return String(element && element.textContent || '').replace(/\s+/g, ' ').trim();
}

// Nombres de cada persona (persName) o grupo (name) de la cabecera, por xml:id.
// El primero es el que se muestra; los demás (si la cabecera los declara) solo
// cuentan para decidir si la etiqueta impresa coincide.
function buildSpeakerNameIndex(container) {
  var index = new Map();
  Array.from(container.querySelectorAll('tei-person, tei-persongrp')).forEach(function (entry) {
    var id = entry.getAttribute('xml:id') || entry.getAttribute('id');
    var names = Array.from(entry.querySelectorAll('tei-persname, tei-name'))
      .map(textOf)
      .filter(Boolean);
    if (id && names.length > 0) index.set(id, names);
  });
  return index;
}

function certaintyLabel(cert) {
  return CERT_LABELS[String(cert || '').trim().toLowerCase()] || '';
}

// Texto del globo: solo el nombre y, si la atribución no es segura, la certeza.
function buildTooltipText(names, cert) {
  var label = certaintyLabel(cert);
  return names.join(' / ') + (label ? ' (' + label + ')' : '');
}

function speakerOf(sp) {
  return Array.from(sp.children).find(function (child) {
    return child.localName === 'tei-speaker';
  }) || null;
}

// Marca las etiquetas que no coinciden con el nombre de su @who. Devuelve las
// etiquetas marcadas.
function markAmbiguousSpeakers(container) {
  var names = buildSpeakerNameIndex(container);
  var marked = [];

  Array.from(container.querySelectorAll('tei-sp[who]')).forEach(function (sp) {
    var speaker = speakerOf(sp);
    if (!speaker) return;

    var resolved = String(sp.getAttribute('who') || '')
      .split(/\s+/)
      .map(function (token) { return token.replace(/^#/, ''); })
      .filter(Boolean)
      .map(function (id) { return names.get(id); })
      .filter(Boolean);
    if (resolved.length === 0) return;

    var printed = normalizeLabel(textOf(speaker));
    var matches = resolved.some(function (list) {
      return list.some(function (name) { return normalizeLabel(name) === printed; });
    });
    if (matches) return;

    var shown = resolved.map(function (list) { return list[0]; });
    speaker.classList.add('speaker-ambiguous');
    speaker.setAttribute('data-speaker-tooltip', buildTooltipText(shown, sp.getAttribute('cert')));
    marked.push(speaker);
  });

  return marked;
}

function readStoredEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch (error) {
    return true;
  }
}

function persistEnabled(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (error) {
    // La opción funciona aunque el navegador bloquee localStorage.
  }
}

// Interruptor de las opciones de lectura. Al apagarlo se quitan el subrayado y
// el globo (data-tooltip), y las etiquetas dejan de ser enfocables.
function createAmbiguousSpeakersController(options) {
  var container = options.container;
  var checkbox = options.checkbox;
  var marked = [];
  var enabled = readStoredEnabled();

  function render() {
    if (container) container.classList.toggle('speakers-identify', enabled);
    marked.forEach(function (speaker) {
      if (enabled) {
        speaker.setAttribute('data-tooltip', speaker.getAttribute('data-speaker-tooltip'));
        speaker.setAttribute('tabindex', '0');
      } else {
        // Si el globo estaba abierto sobre esta etiqueta, se cierra con ella.
        if (speaker.hasAttribute('aria-describedby')) {
          speaker.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
          speaker.removeAttribute('aria-describedby');
        }
        speaker.removeAttribute('data-tooltip');
        speaker.removeAttribute('tabindex');
      }
    });
    if (checkbox) checkbox.checked = enabled;
  }

  function setEnabled(value) {
    enabled = !!value;
    persistEnabled(enabled);
    render();
  }

  if (checkbox) {
    checkbox.checked = enabled;
    checkbox.addEventListener('change', function () { setEnabled(checkbox.checked); });
  }

  return {
    // Se llama cuando el TEI ya está en el DOM.
    apply: function () {
      marked = container ? markAmbiguousSpeakers(container) : [];
      render();
      return marked;
    },
    setEnabled: setEnabled,
    isEnabled: function () { return enabled; }
  };
}

export {
  normalizeLabel,
  buildSpeakerNameIndex,
  buildTooltipText,
  markAmbiguousSpeakers,
  createAmbiguousSpeakersController
};
