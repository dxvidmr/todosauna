// ============================================
// GESTION DE NOTAS
// ============================================

/**
 * Cargar todas las notas activas (con cache)
 */
async function cargarNotasActivas() {
  if (window.notasActivasCache) {
    console.log('Notas activas desde cache');
    return window.notasActivasCache;
  }

  const { data: notas, error } = await window.SupabaseAPI.getNotasActivas();
  if (error) {
    console.error('Error al cargar notas:', error);
    return [];
  }

  try {
    const { data: evaluacionesAgg, error: evalError } = await window.SupabaseAPI.getNoteEvalCounts();

    if (!evalError && Array.isArray(evaluacionesAgg)) {
      const contadores = {};
      evaluacionesAgg.forEach((row) => {
        if (!row.nota_id) return;
        contadores[row.nota_id] = {
          total: Number(row.total || 0),
          utiles: Number(row.utiles || 0),
          mejorables: Number(row.mejorables || 0)
        };
      });

      notas.forEach((nota) => {
        nota.evaluaciones = contadores[nota.nota_id] || { total: 0, utiles: 0, mejorables: 0 };
      });
    } else {
      notas.forEach((nota) => {
        nota.evaluaciones = { total: 0, utiles: 0, mejorables: 0 };
      });
    }
  } catch (err) {
    console.warn('No se pudieron cargar contadores de evaluaciones:', err);
    notas.forEach((nota) => {
      nota.evaluaciones = { total: 0, utiles: 0, mejorables: 0 };
    });
  }

  window.notasActivasCache = notas;
  console.log(`${notas.length} notas activas cargadas`);
  return notas;
}

/**
 * Filtrar notas que aplican a un conjunto de xml:ids
 */
function filtrarNotasPorXmlIds(todasNotas, xmlIds) {
  return todasNotas.filter((nota) => {
    const targetsNota = nota.target
      .split(' ')
      .map((t) => t.replace('#', ''));

    return targetsNota.some((t) => xmlIds.includes(t));
  });
}

/**
 * Cargar notas de un pasaje especifico
 */
async function cargarNotasPasaje(xmlDoc, pasaje, fragmento) {
  const todasNotas = await cargarNotasActivas();
  const xmlIdsDelPasaje = extraerXmlIdsDelFragmento(fragmento);
  const notasDelPasaje = filtrarNotasPorXmlIds(todasNotas, xmlIdsDelPasaje);

  console.log(`${notasDelPasaje.length} notas para este pasaje`);
  return notasDelPasaje;
}

/**
 * Invalidar cache de notas (util despues de evaluar)
 */
function invalidarCacheNotas() {
  window.notasActivasCache = null;
  console.log('Cache de notas invalidada');
}

/**
 * Registrar evaluacion de nota
 */
async function registrarEvaluacion(datos) {
  const flow = window.Participacion?.flow;
  const source = datos.source || 'lectura';
  if (source === 'lectura' && flow?.ensureModeForSecondLecturaContribution) {
    const canContinue = await flow.ensureModeForSecondLecturaContribution();
    if (!canContinue) {
      console.warn('Envio bloqueado: segundo aporte de lectura sin modo definido');
      return false;
    }
  }

  const datosUsuario = window.userManager.obtenerDatosUsuario() || (() => {
    const sessionData = window.Participacion?.session?.getPublicSessionData?.();
    if (!sessionData?.session_id) return null;
    return { session_id: sessionData.session_id };
  })();
  if (!datosUsuario?.session_id) {
    console.error('No hay sesion activa para registrar evaluacion');
    return false;
  }

  const { error } = await window.SupabaseAPI.submitNoteEvaluation({
    source: source,
    session_id: datosUsuario.session_id,
    pasaje_id: datos.pasaje_id || null,
    nota_id: datos.nota_id,
    nota_version: datos.nota_version,
    vote: datos.vote,
    comment: datos.comment || null
  });

  if (error) {
    console.error('Error al registrar evaluacion:', error);
    return false;
  }

  if (source === 'lectura' && flow?.incrementLecturaParticipationCount) {
    flow.incrementLecturaParticipationCount();
  }

  invalidarCacheNotas();
  console.log('Evaluacion registrada');
  return true;
}

console.log('Notas.js cargado');
