import { extraerXmlIdsDelFragmento } from './pasajes.js';

// ============================================
// GESTION DE NOTAS
// ============================================

function getParticipacionApiV2() {
  return window.Participacion?.apiV2 || null;
}

function getParticipacionSessionData() {
  if (!window.Participacion?.session?.getPublicSessionData) return null;
  return window.Participacion.session.getPublicSessionData();
}

/**
 * Cargar todas las notas activas (con cache)
 */
async function cargarNotasActivas() {
  if (window.notasActivasCache) {
    console.log('Notas activas desde cache');
    return window.notasActivasCache;
  }

  const apiV2 = getParticipacionApiV2();
  if (!apiV2 || typeof apiV2.getNotasActivas !== 'function') {
    console.error('apiV2 no disponible para cargar notas');
    return [];
  }

  const { data: notas, error } = await apiV2.getNotasActivas();
  if (error) {
    console.error('Error al cargar notas:', error);
    return [];
  }

  try {
    const { data: evaluacionesAgg, error: evalError } = await apiV2.getNoteEvalCounts();

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

  const sessionData = getParticipacionSessionData();
  const datosUsuario = sessionData?.session_id ? { session_id: sessionData.session_id } : null;
  if (!datosUsuario?.session_id) {
    console.error('No hay sesion activa para registrar evaluacion');
    return false;
  }

  const apiV2 = getParticipacionApiV2();
  if (!apiV2 || typeof apiV2.submitNoteEvaluation !== 'function') {
    console.error('apiV2 no disponible para enviar evaluaciones');
    return false;
  }

  const { error } = await apiV2.submitNoteEvaluation({
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
    flow.incrementLecturaParticipationCount({ source: source });
  }

  invalidarCacheNotas();
  console.log('Evaluacion registrada');
  return true;
}

console.log('Notas.js cargado');

if (typeof window !== 'undefined') {
  window.cargarNotasActivas = cargarNotasActivas;
  window.filtrarNotasPorXmlIds = filtrarNotasPorXmlIds;
  window.cargarNotasPasaje = cargarNotasPasaje;
  window.invalidarCacheNotas = invalidarCacheNotas;
  window.registrarEvaluacionNota = registrarEvaluacion;
}

export {
  cargarNotasActivas,
  filtrarNotasPorXmlIds,
  cargarNotasPasaje,
  invalidarCacheNotas,
  registrarEvaluacion
};
