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
    .replace(/[\u0300-\u036f]/g, '');
}

function ensureLunrAvailable() {
  if (typeof window === 'undefined' || typeof window.lunr !== 'function') {
    throw new Error('Lunr no estÃ¡ disponible en window.lunr');
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

    fields.forEach(field => {
      const value = field.normalizer
        ? field.normalizer(rawDoc[field.from])
        : normalizeSearchText(rawDoc[field.from]);
      normalizedDoc[field.name] = value;
    });

    normalizedDocs.push(normalizedDoc);
    docsById.set(id, normalizedDoc);
  });

  return { normalizedDocs, docsById };
}

function buildQueryVariants(normalizedQuery) {
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const variants = new Set();
  variants.add(tokens.map(token => `${token}*`).join(' '));
  variants.add(normalizedQuery);
  if (tokens.length === 1 && tokens[0].length > 3) {
    variants.add(`${tokens[0]}~1`);
  }

  return Array.from(variants).filter(Boolean);
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
    docsById,
    sourceTypeBoost: config?.sourceTypeBoost || {}
  };
}

export function searchIndex(indexState, query, options) {
  if (!indexState?.index) return [];

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const variants = buildQueryVariants(normalizedQuery);
  const scoreByRef = new Map();

  variants.forEach(variant => {
    try {
      const hits = indexState.index.search(variant);
      hits.forEach(hit => {
        const currentScore = scoreByRef.get(hit.ref) || 0;
        if (hit.score > currentScore) {
          scoreByRef.set(hit.ref, hit.score);
        }
      });
    } catch (error) {
      // Ignorar variantes invÃ¡lidas; pasamos a la siguiente.
    }
  });

  const sourceTypeBoost = options?.sourceTypeBoost || indexState.sourceTypeBoost || {};
  const limit = Number.isFinite(options?.limit) ? options.limit : 80;

  const results = Array.from(scoreByRef.entries())
    .map(([ref, score]) => {
      const doc = indexState.docsById.get(ref);
      if (!doc) return null;

      const sourceBoost = sourceTypeBoost[doc.sourceType] || 1;
      return {
        ref,
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
