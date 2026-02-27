// ============================================
// GESTIÓN DE PASAJES
// ============================================

/**
 * Normaliza ids (por si vienen con # o espacios)
 */
function normalizarXmlId(id) {
  return (id ?? '').toString().trim().replace(/^#/, '');
}

/**
 * Busca un nodo por xml:id de forma robusta (compatible con TEI con namespace)
 */
function buscarPorXmlId(xmlDoc, id) {
  const xmlId = normalizarXmlId(id);
  if (!xmlId) return null;

  // 1) Intento rápido con querySelector (si el motor CSS lo soporta bien)
  try {
    const el = xmlDoc.querySelector(`[xml\\:id="${xmlId.replace(/"/g, '\\"')}"]`);
    if (el) return el;
  } catch (_) {
    // Ignorar y usar fallback
  }

  // 2) Fallback namespace-safe: recorrer todos los elementos y comparar atributo
  const all = xmlDoc.getElementsByTagNameNS
    ? xmlDoc.getElementsByTagNameNS('*', '*')
    : xmlDoc.getElementsByTagName('*');

  for (const el of all) {
    if (!el.getAttribute) continue;

    // En DOM suele funcionar así aunque el doc tenga namespace TEI
    if (el.getAttribute('xml:id') === xmlId) return el;

    // Por si el navegador expone xml:id con namespace XML
    if (el.getAttributeNS && el.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id') === xmlId) return el;
  }

  return null;
}

/**
 * closest() pero por localName (evita problemas de namespace con selectores CSS)
 */
function closestPorLocalName(el, names) {
  const set = new Set(names);
  let cur = el;
  while (cur && cur.nodeType === 1) {
    if (set.has(cur.localName)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Lowest Common Ancestor (LCA) entre dos elementos
 */
function lowestCommonAncestor(a, b) {
  if (!a || !b) return null;
  const seen = new Set();
  let cur = a;
  while (cur) {
    seen.add(cur);
    cur = cur.parentElement;
  }
  cur = b;
  while (cur) {
    if (seen.has(cur)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Devuelve el hijo directo de `ancestor` que contiene a `node`
 * (o el propio node si ya es hijo directo)
 */
function hijoDirectoQueContiene(ancestor, node) {
  let cur = node;
  while (cur && cur.parentElement && cur.parentElement !== ancestor) {
    cur = cur.parentElement;
  }
  return cur;
}

/**
 * Extrae fragmento del XML basándose en xml:id de inicio y fin
 */
function extraerFragmento(xmlDoc, pasaje) {
  const inicioId = normalizarXmlId(pasaje.inicio_xmlid);
  const finId = normalizarXmlId(pasaje.fin_xmlid);

  const elementoInicio = buscarPorXmlId(xmlDoc, inicioId);
  const elementoFin = buscarPorXmlId(xmlDoc, finId);

  if (!elementoInicio || !elementoFin) {
    console.error('No se encontraron elementos:', inicioId, finId, { elementoInicio, elementoFin });
    return null;
  }

  // CASO 1: Mismo elemento
  if (inicioId === finId) {
    const contenedor = xmlDoc.createElement('div');
    contenedor.setAttribute('class', 'pasaje-fragmento');
    contenedor.appendChild(elementoInicio.cloneNode(true));
    return contenedor;
  }

  // CASO 2: Fin dentro de inicio
  if (elementoInicio.contains(elementoFin)) {
    const contenedor = xmlDoc.createElement('div');
    contenedor.setAttribute('class', 'pasaje-fragmento');
    contenedor.appendChild(elementoInicio.cloneNode(true));
    return contenedor;
  }

  // CASO 3: Diferente nivel (mixto)
  // Preferimos expandir a unidades “bloque” (sp/stage) si existen
  const bloqueInicio = closestPorLocalName(elementoInicio, ['sp', 'stage']) || elementoInicio;
  const bloqueFin = closestPorLocalName(elementoFin, ['sp', 'stage']) || elementoFin;

  // Buscar ancestro común real
  const lca = lowestCommonAncestor(bloqueInicio, bloqueFin);
  if (!lca) {
    console.error('No se encontró ancestro común para:', inicioId, finId);
    return null;
  }

  // Los dos “bloques” a capturar deben ser hijos directos del LCA
  const startChild = hijoDirectoQueContiene(lca, bloqueInicio);
  const endChild = hijoDirectoQueContiene(lca, bloqueFin);

  if (!startChild || !endChild || !lca.children) {
    console.error('No se pudo resolver el rango de captura:', { inicioId, finId, lca, startChild, endChild });
    return null;
  }

  const hijos = Array.from(lca.children);
  const elementos = [];
  let capturando = false;

  for (const hijo of hijos) {
    if (hijo === startChild || hijo.contains(elementoInicio)) capturando = true;

    if (capturando) elementos.push(hijo);

    if (hijo === endChild || hijo.contains(elementoFin)) break;
  }

  if (elementos.length === 0) {
    console.error('Rango vacío al capturar:', { inicioId, finId, lca, startChild, endChild });
    return null;
  }

  const contenedor = xmlDoc.createElement('div');
  contenedor.setAttribute('class', 'pasaje-fragmento');
  elementos.forEach(el => contenedor.appendChild(el.cloneNode(true)));
  return contenedor;
}

/**
 * Extrae xml:ids de un fragmento (robusto)
 */
function extraerXmlIdsDelFragmento(fragmento) {
  const ids = [];
  const all = fragmento.getElementsByTagName
    ? fragmento.getElementsByTagName('*')
    : fragmento.querySelectorAll('*');

  for (const el of all) {
    if (!el.getAttribute) continue;
    const id = el.getAttribute('xml:id');
    if (id) ids.push(id);
  }

  // únicos
  return Array.from(new Set(ids));
}

console.log('✓ Pasajes.js cargado');

if (typeof window !== 'undefined') {
  window.normalizarXmlId = normalizarXmlId;
  window.buscarPorXmlId = buscarPorXmlId;
  window.extraerFragmento = extraerFragmento;
  window.extraerXmlIdsDelFragmento = extraerXmlIdsDelFragmento;
}

export {
  normalizarXmlId,
  buscarPorXmlId,
  extraerFragmento,
  extraerXmlIdsDelFragmento
};
