import '../lectura/CETEI.js';
import '../lectura/laboratorio.js';
import '../participacion/sugerencias.js';

if (typeof window !== 'undefined') {
  var xmlBase = new URL('../../data/tei', import.meta.url).toString().replace(/\/$/, '');
  var jsBase = new URL('../lectura', import.meta.url).toString().replace(/\/$/, '');

  window.SITE_PATHS = Object.assign({}, window.SITE_PATHS || {}, {
    xml: xmlBase,
    js: jsBase
  });
}
