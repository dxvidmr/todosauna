// ============================================
// FUNCIONES AUXILIARES GENERALES Y DE RENDERIZACIÓN TEI
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

// ============================================
// UTILIDADES DE RENDERIZACIÓN TEI
// ============================================

/**
 * Función para alinear versos partidos aplicando padding-left
 * según la longitud acumulada de las partes anteriores
 */
function alignSplitVerses(container) {
    const allVerses = container.querySelectorAll('tei-l[part]');
    
    let accumulatedLength = 0; // Longitud acumulada del texto de versos anteriores
    
    allVerses.forEach(verse => {
        const part = verse.getAttribute('part');
        // Obtener texto normalizado (sin espacios extra)
        const verseText = verse.textContent.replace(/\s+/g, ' ').trim();
        
        if (part === 'I') {
            // Parte inicial: resetear y no aplicar padding
            verse.style.paddingLeft = '0';
            
            // Calcular la longitud de esta parte para las siguientes
            accumulatedLength = verseText.length + 1; // +1 para el espacio
            
            console.log(`Verso part="I": "${verseText}" (${verseText.length} chars) - acumulado: ${accumulatedLength}ch`);
            
        } else if (part === 'M' || part === 'F') {
            // Partes intermedias o finales: aplicar padding
            verse.style.paddingLeft = `${accumulatedLength}ch`;
            
            console.log(`Verso part="${part}": "${verseText}" (${verseText.length} chars) - padding: ${accumulatedLength}ch`);
            
            // Si es parte intermedia, acumular su longitud para la siguiente
            if (part === 'M') {
                accumulatedLength = accumulatedLength + verseText.length + 1; // +1 para espacio
            }
        }
    });
}

/**
 * Aplicar numeración de versos
 * @param {HTMLElement} container - Contenedor con elementos tei-l
 * @param {string} modo - 'todos' | 'cada5' | 'ninguno'
 */
function aplicarNumeracionVersos(container, modo = 'cada5') {
    if (!container) return;
    
    const versos = container.querySelectorAll('tei-l[n]');
    
    versos.forEach(verso => {
        const numeroVerso = parseInt(verso.getAttribute('n'));
        
        // Remover número anterior si existe
        const numeroExistente = verso.querySelector('.numero-verso');
        if (numeroExistente) {
            numeroExistente.remove();
        }
        
        // Determinar si mostrar el número
        let mostrar = false;
        if (modo === 'todos') {
            mostrar = true;
        } else if (modo === 'cada5') {
            mostrar = numeroVerso % 5 === 0;
        }
        
        if (mostrar && !isNaN(numeroVerso)) {
            const span = document.createElement('span');
            span.className = 'numero-verso';
            span.textContent = numeroVerso;
            verso.appendChild(span);
        }
    });
    
    console.log(`Numeración de versos aplicada: modo ${modo}`);
}

console.log('Utils y rendering utils cargados');
