// ============================================
// FUNCIONES AUXILIARES GENERALES
// ============================================

/**
 * Hash de email con SHA-256
 */
async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mostrar toast notification
 */
function mostrarToast(mensaje, duracion = 2000) {
  // Evitar duplicados
  const existente = document.querySelector('.toast');
  if (existente) existente.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensaje;
  
  document.body.appendChild(toast);
  
  // Animación de entrada
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remover después de duración
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duracion);
}

/**
 * Cargar XML con caché
 */
async function cargarXMLCacheado(url) {
  // Verificar si ya está en caché
  if (window.xmlCache && window.xmlCache[url]) {
    console.log('XML cargado desde caché:', url);
    return window.xmlCache[url];
  }
  
  // Cargar XML
  console.log('Cargando XML:', url);
  const response = await fetch(url);
  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  // Guardar en caché
  if (!window.xmlCache) window.xmlCache = {};
  window.xmlCache[url] = xmlDoc;
  
  console.log('XML cargado y cacheado:', url);
  return xmlDoc;
}

/**
 * Formatear fecha relativa (ej: "hace 2 horas")
 */
function formatearFechaRelativa(timestamp) {
  const ahora = new Date();
  const fecha = new Date(timestamp);
  const diferencia = ahora - fecha;
  
  const minutos = Math.floor(diferencia / 60000);
  const horas = Math.floor(diferencia / 3600000);
  const dias = Math.floor(diferencia / 86400000);
  
  if (minutos < 1) return 'Ahora mismo';
  if (minutos < 60) return `Hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
  if (horas < 24) return `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
  return `Hace ${dias} día${dias > 1 ? 's' : ''}`;
}

console.log('Utils cargado');
