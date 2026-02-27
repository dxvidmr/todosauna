import '../lectura/CETEI.js';
import '../lectura/utils.js';
import '../lectura/pasajes.js';
import '../lectura/notas.js';
import '../lectura/evaluaciones-stats.js';
import '../lectura/laboratorio-de-notas.js';
import '../lectura/sugerencias-notas.js';

if (typeof window !== 'undefined') {
  var xmlBase = new URL('../../data/tei', import.meta.url).toString().replace(/\/$/, '');
  var jsBase = new URL('../lectura', import.meta.url).toString().replace(/\/$/, '');

  window.SITE_PATHS = Object.assign({}, window.SITE_PATHS || {}, {
    xml: xmlBase,
    js: jsBase
  });
}
