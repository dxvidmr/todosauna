const XML_NS = 'http://www.w3.org/XML/1998/namespace';

function toText(value) {
  return String(value == null ? '' : value);
}

function normalizeWhitespace(value) {
  return toText(value).replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength) {
  const text = normalizeWhitespace(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function getXmlId(node) {
  if (!node || typeof node.getAttribute !== 'function') return '';
  return normalizeWhitespace(
    node.getAttribute('xml:id')
    || (node.getAttributeNS ? node.getAttributeNS(XML_NS, 'id') : '')
    || node.getAttribute('id')
  );
}

function getSpeakerForLine(lineNode) {
  if (!lineNode || typeof lineNode.closest !== 'function') return '';
  const speechNode = lineNode.closest('tei-sp, sp');
  if (!speechNode || typeof speechNode.querySelector !== 'function') return '';
  return normalizeWhitespace(speechNode.querySelector('tei-speaker, speaker')?.textContent || '');
}

function parseAnaTokens(value) {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .map(token => token.replace(/^#/, '').trim())
    .filter(Boolean);
}

function buildVerseDocs(textRoot, baseUrl) {
  if (!textRoot || typeof textRoot.querySelectorAll !== 'function') return [];
  const lineNodes = Array.from(textRoot.querySelectorAll('tei-l, l'));
  const docs = [];

  lineNodes.forEach((lineNode, index) => {
    const body = normalizeWhitespace(lineNode.textContent || '');
    if (!body) return;

    const lineId = getXmlId(lineNode) || normalizeWhitespace(lineNode.getAttribute('id')) || `line-${index + 1}`;
    const lineNumber = normalizeWhitespace(lineNode.getAttribute('n') || '');
    const speaker = getSpeakerForLine(lineNode);
    const title = lineNumber ? `Verso ${lineNumber}` : `Verso ${index + 1}`;
    const metaParts = [];
    if (speaker) metaParts.push(`Intervención: ${speaker}`);
    if (lineNumber) metaParts.push(`n. ${lineNumber}`);

    docs.push({
      id: `lectura-verse:${lineId}`,
      sourceType: 'lectura-verse',
      title,
      body,
      meta: metaParts.join(' · '),
      url: `${baseUrl}?ta_target=${encodeURIComponent(`verse:${lineId}`)}`,
      preview: truncateText(body, 220),
      targetType: 'verse',
      targetId: lineId,
      lineNumber,
      speaker
    });
  });

  return docs;
}

function buildNoteDocs(notesRoot, baseUrl) {
  if (!notesRoot || typeof notesRoot.querySelectorAll !== 'function') return [];
  const noteNodes = Array.from(notesRoot.querySelectorAll('note, tei-note'));
  const docs = [];

  noteNodes.forEach((noteNode, index) => {
    const noteId = getXmlId(noteNode) || normalizeWhitespace(noteNode.getAttribute('id')) || `note-${index + 1}`;
    const body = normalizeWhitespace(noteNode.textContent || '');
    if (!body) return;

    const anaTokens = parseAnaTokens(noteNode.getAttribute('ana') || '');
    const targetTokens = parseAnaTokens((noteNode.getAttribute('target') || '').replace(/#/g, ''));
    const metaParts = [];
    if (anaTokens.length) metaParts.push(`Tipos: ${anaTokens.join(', ')}`);
    if (targetTokens.length) metaParts.push(`Destino: ${targetTokens.join(', ')}`);

    docs.push({
      id: `lectura-note:${noteId}`,
      sourceType: 'lectura-note',
      title: `Nota ${noteId}`,
      body,
      meta: metaParts.join(' · '),
      url: `${baseUrl}?ta_target=${encodeURIComponent(`note:${noteId}`)}`,
      preview: truncateText(body, 220),
      targetType: 'note',
      targetId: noteId
    });
  });

  return docs;
}

export function buildLecturaSearchDocsFromSources({ textRoot, notesRoot, baseUrl = '/lectura/' } = {}) {
  return [
    ...buildVerseDocs(textRoot, baseUrl),
    ...buildNoteDocs(notesRoot, baseUrl)
  ];
}

export async function buildLecturaSearchDocsFromUrls({
  teiUrl = '/assets/data/tei/fuenteovejuna.xml',
  notesUrl = '/assets/data/tei/notas.xml',
  baseUrl = '/lectura/'
} = {}) {
  const [teiResponse, notesResponse] = await Promise.all([
    fetch(teiUrl),
    fetch(notesUrl)
  ]);

  if (!teiResponse.ok) {
    throw new Error(`No se pudo cargar TEI (${teiResponse.status})`);
  }
  if (!notesResponse.ok) {
    throw new Error(`No se pudo cargar notas (${notesResponse.status})`);
  }

  const [teiText, notesText] = await Promise.all([
    teiResponse.text(),
    notesResponse.text()
  ]);

  const parser = new DOMParser();
  const teiDoc = parser.parseFromString(teiText, 'application/xml');
  const notesDoc = parser.parseFromString(notesText, 'application/xml');

  return buildLecturaSearchDocsFromSources({
    textRoot: teiDoc,
    notesRoot: notesDoc,
    baseUrl
  });
}
