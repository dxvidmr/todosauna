// ============================================
// UTILIDADES COMUNES DE RENDERIZACIÓN TEI
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

console.log('✓ Rendering utils cargado');
