import '../lectura/CETEI.js';
import '../lectura/utils.js';
import '../lectura/notas.js';
import '../lectura/evaluaciones-stats.js';
import '../lectura/sala-de-lectura.js';
import '../lectura/sala-de-lectura-evaluacion.js';
import '../lectura/sugerencias-notas.js';

function bootstrapLecturaXml() {
  if (typeof window === 'undefined') return;
  if (window.__TA_LECTURA_XML_BOOTSTRAPPED__) return;
  window.__TA_LECTURA_XML_BOOTSTRAPPED__ = true;

  var teiContainer = document.getElementById('TEI');
  if (!teiContainer) return;

  window.notasXML = null;

  var notasUrl = new URL('../../data/tei/notas.xml', import.meta.url).toString();
  fetch(notasUrl)
    .then(function (response) { return response.text(); })
    .then(function (str) {
      var parser = new DOMParser();
      window.notasXML = parser.parseFromString(str, 'application/xml');
      console.log('Notas XML cargadas:', window.notasXML);
    })
    .catch(function (error) {
      console.error('Error cargando notas.xml:', error);
    });

  if (typeof window.CETEI !== 'function') {
    console.error('CETEI no esta disponible para cargar el TEI principal');
    return;
  }

  var teiUrl = new URL('../../data/tei/fuenteovejuna.xml', import.meta.url).toString();
  var cetei = new window.CETEI();
  cetei.getHTML5(teiUrl, function (data) {
    teiContainer.appendChild(data);
    console.log('TEI principal cargado');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLecturaXml, { once: true });
} else {
  bootstrapLecturaXml();
}
