const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const xmlCache = new Map();
const SINGLE_TARGET_LINE_RADIUS = 3;

function toText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeWhitespace(value) {
  return toText(value).replace(/\s+/g, ' ').trim();
}

function getLocalName(node) {
  return String(node && node.localName ? node.localName : '').toLowerCase();
}

function getXmlId(node) {
  if (!node || typeof node.getAttribute !== 'function') return '';
  return toText(
    node.getAttribute('xml:id')
    || (node.getAttributeNS ? node.getAttributeNS(XML_NS, 'id') : '')
    || node.getAttribute('id')
  );
}

function getNodesByLocalName(xmlDoc, localName) {
  if (!xmlDoc) return [];
  const nodes = xmlDoc.getElementsByTagName('*');
  const target = String(localName || '').toLowerCase();
  const result = [];
  for (let i = 0; i < nodes.length; i += 1) {
    if (getLocalName(nodes[i]) === target) {
      result.push(nodes[i]);
    }
  }
  return result;
}

async function loadXmlDocument(url) {
  if (!url) {
    throw new Error('URL de XML no valida');
  }
  if (xmlCache.has(url)) {
    return xmlCache.get(url);
  }

  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Error cargando XML: ' + response.status);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    if (xmlDoc.querySelector('parsererror')) {
      throw new Error('XML invalido');
    }
    return xmlDoc;
  })();

  xmlCache.set(url, promise);
  return promise;
}

function normalizeTargetToken(token) {
  return toText(token).replace(/^#/, '');
}

function normalizeTargetCandidates(rawId) {
  const id = normalizeTargetToken(rawId);
  if (!id) return [];

  const candidates = [id];
  const compactLine = /^l-(\d+)([a-z])$/i.exec(id);
  if (compactLine) {
    candidates.push('l-' + compactLine[1] + '-' + compactLine[2].toLowerCase());
  }
  const dashedLine = /^l-(\d+)-([a-z])$/i.exec(id);
  if (dashedLine) {
    candidates.push('l-' + dashedLine[1] + dashedLine[2].toLowerCase());
  }
  return Array.from(new Set(candidates));
}

function resolveTargetNode(teiIndex, rawId) {
  const candidates = normalizeTargetCandidates(rawId);
  for (let i = 0; i < candidates.length; i += 1) {
    const node = teiIndex.byId.get(candidates[i]);
    if (node) return node;
  }
  return null;
}

function buildTeiIndex(teiDoc) {
  const allElements = teiDoc ? teiDoc.getElementsByTagName('*') : [];
  const byId = new Map();
  const orderByNode = new Map();
  const lineNodes = [];
  const lineOrder = [];
  const lineIndexById = new Map();

  for (let i = 0; i < allElements.length; i += 1) {
    const node = allElements[i];
    const localName = getLocalName(node);
    const xmlId = getXmlId(node);

    orderByNode.set(node, i);

    if (localName === 'l') {
      lineNodes.push(node);
      lineOrder.push(i);
      if (xmlId) {
        lineIndexById.set(xmlId, lineNodes.length - 1);
      }
    }

    if (xmlId && (localName === 'l' || localName === 'seg' || localName === 'stage')) {
      byId.set(xmlId, node);
    }
  }

  return {
    byId,
    orderByNode,
    lineNodes,
    lineOrder,
    lineIndexById
  };
}

function findClosestLineParent(node) {
  let current = node;
  while (current && current.nodeType === 1) {
    if (getLocalName(current) === 'l') return current;
    current = current.parentElement;
  }
  return null;
}

function getLineWindow(teiIndex, lineNode, radius) {
  if (!lineNode) return [];
  const lineId = getXmlId(lineNode);
  if (!lineId) return [lineNode];

  let currentIndex = teiIndex.lineIndexById.get(lineId);
  if (!Number.isInteger(currentIndex)) {
    currentIndex = teiIndex.lineNodes.indexOf(lineNode);
  }
  if (currentIndex < 0) return [lineNode];

  const safeRadius = Number.isInteger(radius) && radius >= 0 ? radius : 1;
  const start = Math.max(0, currentIndex - safeRadius);
  const end = Math.min(teiIndex.lineNodes.length - 1, currentIndex + safeRadius);
  const nodes = [];
  for (let i = start; i <= end; i += 1) {
    const node = teiIndex.lineNodes[i];
    if (node) nodes.push(node);
  }

  return nodes;
}

function findLineInsertionIndex(lineOrder, targetOrder) {
  let low = 0;
  let high = lineOrder.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (lineOrder[mid] <= targetOrder) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function getStageNeighborLines(teiIndex, stageNode, radius) {
  const stageOrder = teiIndex.orderByNode.get(stageNode);
  if (!Number.isFinite(stageOrder)) return [];

  const insertion = findLineInsertionIndex(teiIndex.lineOrder, stageOrder);
  const safeRadius = Number.isInteger(radius) && radius >= 0 ? radius : 1;
  const prevStart = Math.max(0, insertion - safeRadius);
  const prevEnd = Math.max(-1, insertion - 1);
  const nextStart = Math.min(teiIndex.lineNodes.length, insertion);
  const nextEnd = Math.min(teiIndex.lineNodes.length - 1, insertion + safeRadius - 1);

  const neighbors = [];
  for (let i = prevStart; i <= prevEnd; i += 1) {
    const node = teiIndex.lineNodes[i];
    if (node) neighbors.push(node);
  }
  for (let i = nextStart; i <= nextEnd; i += 1) {
    const node = teiIndex.lineNodes[i];
    if (node) neighbors.push(node);
  }
  return neighbors;
}

function addContextItem(bucket, item) {
  if (!item || !item.key) return;
  const existing = bucket.get(item.key);
  if (!existing || item.order < existing.order) {
    bucket.set(item.key, item);
  }
}

function buildLineContextItem(teiIndex, lineNode) {
  const id = getXmlId(lineNode);
  const text = normalizeWhitespace(lineNode ? lineNode.textContent : '');
  if (!id) return null;
  const order = teiIndex.orderByNode.get(lineNode);
  if (!Number.isFinite(order)) return null;
  return {
    key: 'line:' + id,
    kind: 'line',
    order,
    xmlId: id,
    text,
    node: lineNode
  };
}

function buildStageContextItem(teiIndex, stageNode) {
  const id = getXmlId(stageNode);
  const text = normalizeWhitespace(stageNode ? stageNode.textContent : '');
  if (!id) return null;
  const order = teiIndex.orderByNode.get(stageNode);
  if (!Number.isFinite(order)) return null;
  return {
    key: 'stage:' + id,
    kind: 'stage',
    order,
    xmlId: id,
    text,
    node: stageNode
  };
}

function buildContextFragmentXml(orderedItems) {
  if (!Array.isArray(orderedItems) || !orderedItems.length) return '';
  const serializer = new XMLSerializer();
  const chunks = [];

  for (let i = 0; i < orderedItems.length; i += 1) {
    const sourceNode = orderedItems[i] && orderedItems[i].node;
    if (!sourceNode || typeof sourceNode.cloneNode !== 'function') continue;
    chunks.push(serializer.serializeToString(sourceNode.cloneNode(true)));
  }

  if (!chunks.length) return '';
  return '<div class="home-note-context-fragment">' + chunks.join('') + '</div>';
}

function buildNoteContext(teiIndex, targetAttr, maxVerses) {
  const targets = toText(targetAttr)
    .split(/\s+/)
    .map((target) => normalizeTargetToken(target))
    .filter(Boolean);
  if (!targets.length) return null;

  const uniqueTargets = Array.from(new Set(targets));
  const isSingleTarget = uniqueTargets.length === 1;
  const contextBucket = new Map();
  let resolvedTargets = 0;

  uniqueTargets.forEach((targetId) => {
    const targetNode = resolveTargetNode(teiIndex, targetId);
    if (!targetNode) return;

    const targetName = getLocalName(targetNode);
    if (targetName === 'l') {
      resolvedTargets += 1;
      const nodes = isSingleTarget
        ? getLineWindow(teiIndex, targetNode, SINGLE_TARGET_LINE_RADIUS)
        : [targetNode];
      nodes.forEach((lineNode) => {
        addContextItem(contextBucket, buildLineContextItem(teiIndex, lineNode));
      });
      return;
    }

    if (targetName === 'seg') {
      const parentLine = findClosestLineParent(targetNode);
      if (!parentLine) return;
      resolvedTargets += 1;
      const nodes = isSingleTarget
        ? getLineWindow(teiIndex, parentLine, SINGLE_TARGET_LINE_RADIUS)
        : [parentLine];
      nodes.forEach((lineNode) => {
        addContextItem(contextBucket, buildLineContextItem(teiIndex, lineNode));
      });
      return;
    }

    if (targetName === 'stage') {
      resolvedTargets += 1;
      addContextItem(contextBucket, buildStageContextItem(teiIndex, targetNode));
      if (isSingleTarget) {
        getStageNeighborLines(teiIndex, targetNode, SINGLE_TARGET_LINE_RADIUS).forEach((lineNode) => {
          addContextItem(contextBucket, buildLineContextItem(teiIndex, lineNode));
        });
      }
    }
  });

  if (!resolvedTargets || !contextBucket.size) return null;

  const orderedItems = Array.from(contextBucket.values()).sort((a, b) => a.order - b.order);
  const verseCount = orderedItems.filter((item) => item.kind === 'line').length;
  if (verseCount > maxVerses) {
    return null;
  }

  const fragmentXml = buildContextFragmentXml(orderedItems);
  const publicItems = orderedItems.map((item) => ({
    key: item.key,
    kind: item.kind,
    order: item.order,
    xml_id: item.xmlId || '',
    text: item.text || ''
  }));

  return {
    verseCount,
    items: publicItems,
    fragment_xml: fragmentXml
  };
}

function extractNotesFromXml(notesDoc, teiIndex, maxVerses) {
  const noteNodes = getNodesByLocalName(notesDoc, 'note');
  const notes = [];

  for (let i = 0; i < noteNodes.length; i += 1) {
    const noteNode = noteNodes[i];
    const noteId = getXmlId(noteNode);
    const target = toText(noteNode.getAttribute('target'));
    const text = normalizeWhitespace(noteNode.textContent);

    if (!noteId || !target || !text) continue;

    const context = buildNoteContext(teiIndex, target, maxVerses);
    if (!context) continue;

    notes.push({
      nota_id: noteId,
      texto_nota: text,
      type: toText(noteNode.getAttribute('type')),
      subtype: toText(noteNode.getAttribute('subtype')),
      target,
      context,
      version: '1.0',
      evaluaciones: { total: 0, utiles: 0, mejorables: 0 }
    });
  }

  return notes;
}

async function loadStaticNotesWithContext(options) {
  const config = options || {};
  const notesUrl = toText(config.notesUrl);
  const teiUrl = toText(config.teiUrl);
  const parsedMaxVerses = Number(config.maxVerses);
  const maxVerses = Number.isFinite(parsedMaxVerses) ? parsedMaxVerses : 9;

  if (!notesUrl || !teiUrl) {
    throw new Error('Faltan rutas de XML para construir contexto de notas');
  }

  const [notesDoc, teiDoc] = await Promise.all([
    loadXmlDocument(notesUrl),
    loadXmlDocument(teiUrl)
  ]);

  const teiIndex = buildTeiIndex(teiDoc);
  return extractNotesFromXml(notesDoc, teiIndex, maxVerses);
}

export {
  loadStaticNotesWithContext
};
