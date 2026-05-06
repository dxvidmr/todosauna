function toText(value) {
  return String(value == null ? '' : value);
}

function collapseWhitespace(value) {
  return toText(value).replace(/\s+/g, ' ').trim();
}

export function normalizeSearchText(value) {
  return collapseWhitespace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureLunrAvailable() {
  if (typeof window === 'undefined' || typeof window.lunr !== 'function') {
    throw new Error('Lunr no está disponible en window.lunr');
  }
  return window.lunr;
}

function buildNormalizedDocs(rawDocs, fields) {
  const normalizedDocs = [];
  const docsById = new Map();

  (rawDocs || []).forEach((rawDoc, index) => {
    if (!rawDoc) return;

    const id = collapseWhitespace(rawDoc.id || `doc-${index + 1}`);
    if (!id) return;

    const normalizedDoc = {
      ...rawDoc,
      id
    };

    const searchFields = fields.map(field => {
      const value = field.normalizer
        ? field.normalizer(rawDoc[field.from])
        : normalizeSearchText(rawDoc[field.from]);
      normalizedDoc[field.name] = value;
      return {
        name: field.name,
        boost: field.boost || 1,
        value
      };
    });

    Object.defineProperty(normalizedDoc, '_searchFields', {
      value: searchFields,
      enumerable: false
    });

    normalizedDocs.push(normalizedDoc);
    docsById.set(id, normalizedDoc);
  });

  return { normalizedDocs, docsById };
}

function escapeRegExp(value) {
  return toText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildExactMatchPattern(normalizedQuery) {
  if (!normalizedQuery) return null;
  const boundary = '[^\\p{Letter}\\p{Number}]';
  return new RegExp(`(^|${boundary})${escapeRegExp(normalizedQuery)}(?=$|${boundary})`, 'gu');
}

function countExactMatches(value, normalizedQuery) {
  const text = toText(value);
  const pattern = buildExactMatchPattern(normalizedQuery);
  if (!text || !pattern) return 0;

  let count = 0;
  while (pattern.exec(text) !== null) {
    count += 1;
  }
  return count;
}

function scoreExactDocument(doc, normalizedQuery, fields) {
  const searchFields = Array.isArray(doc?._searchFields)
    ? doc._searchFields
    : (fields || []).map(field => ({
        name: field.name,
        boost: field.boost || 1,
        value: doc?.[field.name]
      }));

  return searchFields.reduce((score, field) => {
    const matches = countExactMatches(field.value, normalizedQuery);
    return score + (matches * (field.boost || 1));
  }, 0);
}

export function buildIndex(rawDocs, config) {
  const lunr = ensureLunrAvailable();
  const fields = Array.isArray(config?.fields) && config.fields.length
    ? config.fields
    : [
        { name: 'search_title', from: 'title', boost: 8 },
        { name: 'search_body', from: 'body', boost: 3 },
        { name: 'search_meta', from: 'meta', boost: 2 }
      ];

  const { normalizedDocs, docsById } = buildNormalizedDocs(rawDocs, fields);
  const index = lunr(function () {
    this.ref('id');
    fields.forEach(field => this.field(field.name, { boost: field.boost || 1 }));
    normalizedDocs.forEach(doc => this.add(doc));
  });

  return {
    index,
    fields,
    normalizedDocs,
    docsById,
    sourceTypeBoost: config?.sourceTypeBoost || {}
  };
}

export function searchIndex(indexState, query, options) {
  if (!indexState?.docsById) return [];

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const sourceTypeBoost = options?.sourceTypeBoost || indexState.sourceTypeBoost || {};
  const limit = Number.isFinite(options?.limit) ? options.limit : 80;
  const docs = Array.isArray(indexState.normalizedDocs)
    ? indexState.normalizedDocs
    : Array.from(indexState.docsById.values());

  const results = docs
    .map(doc => {
      const score = scoreExactDocument(doc, normalizedQuery, indexState.fields);
      if (!score) return null;
      const sourceBoost = sourceTypeBoost[doc.sourceType] || 1;
      return {
        ref: doc.id,
        score,
        weightedScore: score * sourceBoost,
        doc
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.weightedScore - a.weightedScore);

  return results.slice(0, limit);
}

export function groupResultsBySourceType(results) {
  const groups = new Map();
  (results || []).forEach(result => {
    const key = result?.doc?.sourceType || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  });
  return groups;
}

export const SOURCE_TYPE_LABELS = {
  page: 'Páginas',
  collection: 'Colección',
  'lectura-verse': 'Lectura · Versos',
  'lectura-stage': 'Lectura · Acotaciones',
  'lectura-note': 'Lectura · Notas'
};
