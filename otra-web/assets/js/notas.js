// ============================================
// GESTIÓN DE NOTAS
// ============================================

/**
 * Cargar todas las notas activas (con caché)
 */
async function cargarNotasActivas() {
  // Verificar caché
  if (window.notasActivasCache) {
    console.log('✓ Notas activas desde caché');
    return window.notasActivasCache;
  }
  
  // Cargar notas desde Supabase
  const { data: notas, error } = await window.supabaseClient
    .from('notas_activas')
    .select('*');
  
  if (error) {
    console.error('Error al cargar notas:', error);
    return [];
  }
  
  // Cargar contadores de evaluaciones para cada nota
  try {
    const { data: evaluaciones, error: evalError } = await window.supabaseClient
      .from('evaluaciones')
      .select('nota_id, vote')
      .not('nota_id', 'is', null);  // Solo evaluaciones con nota_id
    
    console.log('Evaluaciones cargadas:', evaluaciones?.length || 0);
    
    if (!evalError && evaluaciones && evaluaciones.length > 0) {
      // Debug: mostrar primeras evaluaciones
      console.log('Ejemplo de evaluaciones:', evaluaciones.slice(0, 3));
      
      // Crear mapa de contadores por nota_id
      const contadores = {};
      evaluaciones.forEach(e => {
        if (!e.nota_id) return; // Saltar si no hay nota_id
        
        if (!contadores[e.nota_id]) {
          contadores[e.nota_id] = { total: 0, utiles: 0, mejorables: 0 };
        }
        contadores[e.nota_id].total++;
        // Soportar ambos formatos de vote: up/down y util/mejorable
        if (e.vote === 'up' || e.vote === 'util') contadores[e.nota_id].utiles++;
        if (e.vote === 'down' || e.vote === 'mejorable') contadores[e.nota_id].mejorables++;
      });
      
      console.log('Contadores generados:', Object.keys(contadores).length, 'notas con evaluaciones');
      console.log('Ejemplo de contadores:', Object.entries(contadores).slice(0, 3));
      
      // Agregar contadores a cada nota
      notas.forEach(nota => {
        nota.evaluaciones = contadores[nota.nota_id] || { total: 0, utiles: 0, mejorables: 0 };
      });
      
      console.log('✓ Contadores de evaluaciones agregados');
    } else {
      console.log('No hay evaluaciones en la BD o error:', evalError);
      notas.forEach(nota => {
        nota.evaluaciones = { total: 0, utiles: 0, mejorables: 0 };
      });
    }
  } catch (err) {
    console.warn('No se pudieron cargar contadores de evaluaciones:', err);
    // Agregar contadores vacíos si falla
    notas.forEach(nota => {
      nota.evaluaciones = { total: 0, utiles: 0, mejorables: 0 };
    });
  }
  
  // Debug: mostrar estructura de las primeras notas
  if (notas.length > 0) {
    console.log('Estructura de nota ejemplo:', {
      nota_id: notas[0].nota_id,
      evaluaciones: notas[0].evaluaciones
    });
  }
  
  // Guardar en caché
  window.notasActivasCache = notas;
  console.log(`✓ ${notas.length} notas activas cargadas`);
  
  return notas;
}

/**
 * Filtrar notas que aplican a un conjunto de xml:ids
 */
function filtrarNotasPorXmlIds(todasNotas, xmlIds) {
  return todasNotas.filter(nota => {
    // Parsear targets de la nota (pueden ser múltiples)
    const targetsNota = nota.target
      .split(' ')
      .map(t => t.replace('#', ''));
    
    // Verificar si algún target está en los xml:ids
    return targetsNota.some(t => xmlIds.includes(t));
  });
}

/**
 * Cargar notas de un pasaje específico
 */
async function cargarNotasPasaje(xmlDoc, pasaje, fragmento) {
  // 1. Obtener todas las notas activas
  const todasNotas = await cargarNotasActivas();
  
  // 2. Extraer xml:ids del fragmento
  const xmlIdsDelPasaje = extraerXmlIdsDelFragmento(fragmento);
  
  // 3. Filtrar notas que aplican
  const notasDelPasaje = filtrarNotasPorXmlIds(todasNotas, xmlIdsDelPasaje);
  
  console.log(`✓ ${notasDelPasaje.length} notas para este pasaje`);
  return notasDelPasaje;
}

/**
 * Invalidar caché de notas (útil después de evaluar)
 */
function invalidarCacheNotas() {
  window.notasActivasCache = null;
  console.log('✓ Caché de notas invalidada');
}

/**
 * Registrar evaluación de nota
 */
async function registrarEvaluacion(datos) {
  // Verificar que usuario tiene modo definido
  if (!window.userManager.tieneModoDefinido()) {
    await window.modalModo.mostrar();
  }
  
  const datosUsuario = window.userManager.obtenerDatosUsuario();
  
  // Asegurar que la sesión esté creada en BD (primera evaluación)
  if (!datosUsuario.sesion_creada_en_bd) {
    console.log('⏳ Primera evaluación: creando sesión en BD...');
    const exito = await window.modalModo.crearSesionEnBD(datosUsuario);
    if (exito) {
      window.userManager.marcarSesionCreada();
    } else {
      alert('Error al crear sesión. Por favor intenta de nuevo.');
      return false;
    }
  }
  
  const evaluacion = {
    timestamp: new Date().toISOString(),
    session_id: datosUsuario.session_id,
    ...datos
  };
  
  const { error } = await window.supabaseClient
    .from('evaluaciones')
    .insert(evaluacion);
  
  if (error) {
    console.error('Error al registrar evaluación:', error);
    return false;
  }
  
  // Invalidar caché para que se recarguen los contadores
  invalidarCacheNotas();
  
  console.log('✓ Evaluación registrada');
  return true;
}

console.log('✓ Notas.js cargado');
