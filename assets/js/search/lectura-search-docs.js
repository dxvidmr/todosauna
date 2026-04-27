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
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getXmlId(node) {
  if (!node || typeof node.getAttribute !== 'function') return '';
  return normalizeWhitespace(
    node.getAttribute('xml:id')
    || (node.getAttributeNS ? node.getAttributeNS(XML_NS, 'id') : '')
    || node.getAttribute('id')
  );
}

function getSpeakerForNode(node) {
  if (!node || typeof node.closest !== 'function') return '';
  const speechNode = node.closest('tei-sp, sp');
  if (!speechNode || typeof speechNode.querySelector !== 'function') return '';
  return normalizeWhitespace(speechNode.querySelector('tei-speaker, speaker')?.textContent || '');
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
    const speaker = getSpeakerForNode(lineNode);
    const title = lineNumber ? `Verso ${lineNumber}` : `Verso ${index + 1}`;
    const metaParts = [];
    if (speaker) metaParts.push(`Intervención: ${speaker}`);

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

function buildStageDocs(textRoot, baseUrl) {
  if (!textRoot || typeof textRoot.querySelectorAll !== 'function') return [];
  const stageNodes = Array.from(textRoot.querySelectorAll('tei-stage, stage'));
  const docs = [];

  stageNodes.forEach((stageNode, index) => {
    const body = normalizeWhitespace(stageNode.textContent || '');
    if (!body) return;

    const stageId = getXmlId(stageNode) || normalizeWhitespace(stageNode.getAttribute('id')) || `stage-${index + 1}`;
    const stageNumber = normalizeWhitespace(stageNode.getAttribute('n') || '');
    const speaker = getSpeakerForNode(stageNode);
    const title = stageNumber ? `Acotación ${stageNumber}` : `Acotación ${index + 1}`;
    const metaParts = [];
    if (speaker) metaParts.push(`Intervención: ${speaker}`);

    docs.push({
      id: `lectura-stage:${stageId}`,
      sourceType: 'lectura-stage',
      title,
      body,
      meta: metaParts.join(' · '),
      url: `${baseUrl}?ta_target=${encodeURIComponent(`stage:${stageId}`)}`,
      preview: truncateText(body, 220),
      targetType: 'stage',
      targetId: stageId,
      stageNumber,
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
    const title = truncateText(body, 96) || 'Nota';

    docs.push({
      id: `lectura-note:${noteId}`,
      sourceType: 'lectura-note',
      title,
      body,
      meta: '',
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
    ...buildStageDocs(textRoot, baseUrl),
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
