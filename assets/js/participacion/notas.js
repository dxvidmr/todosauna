import { extraerXmlIdsDelFragmento } from '../lectura/pasajes.js';
import {
  loadTeiNotes,
  normalizeChangeRef,
  normalizeTargetToken
} from '../shared/tei-note-context.js';

const NOTES_XML_URL = new URL('../../data/tei/notas.xml', import.meta.url).toString();

function getParticipacionApiV2() {
  return window.Participacion?.apiV2 || null;
}

function normalizeEvalCounts(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    total: Number(source.total || 0),
    utiles: Number(source.utiles || 0),
    mejorables: Number(source.mejorables || 0)
  };
}

function normalizeNoteChange(value) {
  return normalizeChangeRef(value);
}

function buildNoteEvaluationKey(notaId, noteChange) {
  const safeNoteId = String(notaId || '').trim();
  const safeNoteChange = normalizeNoteChange(noteChange);
  return safeNoteId && safeNoteChange ? `${safeNoteId}::${safeNoteChange}` : '';
}

function getCachedNotes() {
  return Array.isArray(window.notasTeiCache) ? window.notasTeiCache : null;
}

function setCachedNotes(notes) {
  window.notasTeiCache = Array.isArray(notes) ? notes : [];
  return window.notasTeiCache;
}

function getCachedNoteRecord(notaId, noteChange = '') {
  const cached = getCachedNotes();
  if (!cached || !notaId) return null;

  const safeNoteId = String(notaId || '').trim();
  const safeNoteChange = normalizeNoteChange(noteChange);

  if (safeNoteChange) {
    return cached.find((note) => (
      String(note?.nota_id || '').trim() === safeNoteId
      && normalizeNoteChange(note?.nota_change) === safeNoteChange
    )) || null;
  }

  return cached.find((note) => String(note?.nota_id || '').trim() === safeNoteId) || null;
}

function setCachedNoteEvaluationCounts(notaId, noteChange, counts) {
  const safeCounts = normalizeEvalCounts(counts);
  const record = getCachedNoteRecord(notaId, noteChange);
  if (!record) return safeCounts;
  record.evaluaciones = safeCounts;
  return safeCounts;
}

async function hydrateEvaluationCounts(notes) {
  const apiV2 = getParticipacionApiV2();
  if (!apiV2 || typeof apiV2.getNoteEvalCounts !== 'function') {
    notes.forEach((note) => {
      note.evaluaciones = normalizeEvalCounts();
    });
    return notes;
  }

  try {
    const { data: evaluacionesAgg, error: evalError } = await apiV2.getNoteEvalCounts();
    if (evalError || !Array.isArray(evaluacionesAgg)) {
      notes.forEach((note) => {
        note.evaluaciones = normalizeEvalCounts();
      });
      return notes;
    }

    const contadores = new Map();
    evaluacionesAgg.forEach((row) => {
      const key = buildNoteEvaluationKey(row?.nota_id, row?.nota_change);
      if (!key) return;
      contadores.set(key, normalizeEvalCounts(row));
    });

    notes.forEach((note) => {
      const key = buildNoteEvaluationKey(note.nota_id, note.nota_change);
      note.evaluaciones = contadores.get(key) || normalizeEvalCounts();
    });
  } catch (_error) {
    notes.forEach((note) => {
      note.evaluaciones = normalizeEvalCounts();
    });
  }

  return notes;
}

async function cargarNotasActivas(options = {}) {
  if (!options.force) {
    const cached = getCachedNotes();
    if (cached) return cached;
  }

  const notesDoc = options.notesDoc || window.notasXML || null;
  const notes = await loadTeiNotes({
    notesDoc,
    notesUrl: options.notesUrl || NOTES_XML_URL
  });

  await hydrateEvaluationCounts(notes);
  return setCachedNotes(notes);
}

function filtrarNotasPorXmlIds(todasNotas, xmlIds) {
  const wanted = new Set((xmlIds || []).map((xmlId) => normalizeTargetToken(xmlId)).filter(Boolean));
  if (!wanted.size) return [];

  return (todasNotas || []).filter((nota) => {
    const targetsNota = String(nota?.target || '')
      .split(/\s+/)
      .map((token) => normalizeTargetToken(token))
      .filter(Boolean);

    return targetsNota.some((targetId) => wanted.has(targetId));
  });
}

async function cargarNotasPasaje(_xmlDoc, _pasaje, fragmento) {
  const todasNotas = await cargarNotasActivas();
  const xmlIdsDelPasaje = extraerXmlIdsDelFragmento(fragmento);
  return filtrarNotasPorXmlIds(todasNotas, xmlIdsDelPasaje);
}

function invalidarCacheNotas() {
  window.notasTeiCache = null;
}

export {
  buildNoteEvaluationKey,
  cargarNotasActivas,
  cargarNotasPasaje,
  filtrarNotasPorXmlIds,
  getCachedNoteRecord,
  invalidarCacheNotas,
  normalizeEvalCounts,
  normalizeNoteChange,
  setCachedNoteEvaluationCounts
};
