import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const teiPath = path.join(repoRoot, "assets", "data", "tei", "fuenteovejuna.xml");
const notesPath = path.join(repoRoot, "assets", "data", "tei", "notas.xml");
const outDir = path.join(repoRoot, "supabase", "data");
const jsonPath = path.join(outDir, "notas_fuenteovejuna_acto1.json");
const csvPath = path.join(outDir, "notas_fuenteovejuna_acto1_import.csv");
const warningsPath = path.join(outDir, "notas_fuenteovejuna_acto1_warnings.md");

const CATEGORY_FIXES = new Map([
  ["lexia", "lexica"],
  ["lexico", "lexica"],
  ["parfrasis", "parafrasis"],
  ["realaia", "realia"],
  ["dramatica", "dramaturgica"],
]);

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function decodeXmlEntities(text) {
  return String(text)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeWhitespace(text) {
  return decodeXmlEntities(text).replace(/\s+/g, " ").trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeInlineHtmlWhitespace(html) {
  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (!part) return "";
      if (part.startsWith("<") && part.endsWith(">")) return part;
      return decodeXmlEntities(part).replace(/\s+/g, " ");
    })
    .join("")
    .trim();
}

function serializeHiTag(rend, innerHtml) {
  const value = normalizeWhitespace(rend).toLowerCase();
  const hasBold = value.includes("bold") || value.includes("negr");
  const hasItalic = value.includes("italic") || value.includes("cursiv");

  if (hasBold && hasItalic) {
    return `<strong><em>${innerHtml}</em></strong>`;
  }
  if (hasBold) {
    return `<strong>${innerHtml}</strong>`;
  }
  if (hasItalic) {
    return `<em>${innerHtml}</em>`;
  }
  return innerHtml;
}

function serializeInlineNoteMarkup(rawBody) {
  let html = decodeXmlEntities(String(rawBody || ""));

  const hiPattern = /<hi\b([^>]*)rend="([^"]*)"([^>]*)>([\s\S]*?)<\/hi>/gi;
  while (/<hi\b/i.test(html)) {
    html = html.replace(hiPattern, (_, _before, rend, _after, inner) => {
      return serializeHiTag(rend, serializeInlineNoteMarkup(inner));
    });
  }

  html = html.replace(/<term\b[^>]*>([\s\S]*?)<\/term>/gi, (_, inner) => {
    return `<term>${serializeInlineNoteMarkup(inner)}</term>`;
  });

  html = html.replace(/<(?!\/?(?:term|em|strong)\b)[^>]+>/gi, " ");
  html = normalizeInlineHtmlWhitespace(html);

  return html;
}

function normalizeCategory(rawValue) {
  const cleaned = normalizeWhitespace(rawValue).toLowerCase();
  if (!cleaned) return "";
  return CATEGORY_FIXES.get(cleaned) || cleaned;
}

function buildXmlIdCandidates(rawId) {
  const id = String(rawId || "").trim().replace(/^#/, "");
  if (!id) return [];

  const candidates = [id];
  const compactLine = /^l-(\d+)([a-z])$/i.exec(id);
  if (compactLine) {
    candidates.push(`l-${compactLine[1]}-${compactLine[2].toLowerCase()}`);
  }

  const dashedLine = /^l-(\d+)-([a-z])$/i.exec(id);
  if (dashedLine) {
    candidates.push(`l-${dashedLine[1]}${dashedLine[2].toLowerCase()}`);
  }

  return Array.from(new Set(candidates));
}

function extractActOneBlock(xml) {
  const start = xml.indexOf("<!--NOTAS ACTO PRIMERO-->");
  const end = xml.indexOf("<!--NOTAS ACTO SEGUNDO-->");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No se pudo delimitar el bloque de notas del acto I.");
  }

  return xml.slice(start, end);
}

function parseNotes(block) {
  const noteRegex = /<note\b([\s\S]*?)>([\s\S]*?)<\/note>/g;
  const notes = [];
  let match;

  while ((match = noteRegex.exec(block)) !== null) {
    const attrs = match[1] || "";
    const body = match[2] || "";
    const getAttr = (name) => {
      const attrMatch = attrs.match(new RegExp(`${name}="([^"]*)"`, "i"));
      return attrMatch ? attrMatch[1] : "";
    };

    notes.push({
      nota_id: getAttr("xml:id"),
      target: getAttr("target"),
      type: getAttr("type"),
      subtype: getAttr("subtype"),
      version: getAttr("n") || "1.0",
      texto_nota: serializeInlineNoteMarkup(body),
    });
  }

  return notes;
}

function normalizeTarget(target, teiIds) {
  const rawTokens = String(target || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const resolved = [];
  const changes = [];
  const missing = [];

  rawTokens.forEach((token) => {
    const base = token.replace(/^#/, "");
    const candidates = buildXmlIdCandidates(base);
    const matched = candidates.find((candidate) => teiIds.has(candidate));

    if (!matched) {
      missing.push(base);
      resolved.push(`#${base}`);
      return;
    }

    if (matched !== base) {
      changes.push({ from: base, to: matched });
    }

    resolved.push(`#${matched}`);
  });

  return {
    target: resolved.join(" "),
    changes,
    missing,
  };
}

function toCsv(rows) {
  const headers = [
    "nota_id",
    "target",
    "version",
    "active",
    "type",
    "subtype",
    "texto_nota",
  ];

  const body = rows.map((row) =>
    headers.map((header) => csvEscape(row[header])).join(",")
  );

  return [headers.join(","), ...body].join("\n");
}

function toWarningsMarkdown(summary) {
  const lines = [
    "# Warnings de notas (acto I)",
    "",
    `- Notas exportadas: ${summary.noteCount}`,
    `- Targets normalizados: ${summary.targetFixes.length}`,
    `- Categorias normalizadas: ${summary.categoryFixes.length}`,
    `- Targets sin resolver: ${summary.unresolvedTargets.length}`,
    "",
  ];

  if (summary.targetFixes.length > 0) {
    lines.push("## Targets normalizados", "");
    summary.targetFixes.forEach((item) => {
      lines.push(`- ${item.nota_id}: ${item.from} -> ${item.to}`);
    });
    lines.push("");
  }

  if (summary.categoryFixes.length > 0) {
    lines.push("## Categorias normalizadas", "");
    summary.categoryFixes.forEach((item) => {
      lines.push(`- ${item.nota_id}: ${item.field} "${item.from}" -> "${item.to}"`);
    });
    lines.push("");
  }

  if (summary.unresolvedTargets.length > 0) {
    lines.push("## Targets sin resolver", "");
    summary.unresolvedTargets.forEach((item) => {
      lines.push(`- ${item.nota_id}: ${item.target}`);
    });
    lines.push("");
  }

  if (
    summary.targetFixes.length === 0 &&
    summary.categoryFixes.length === 0 &&
    summary.unresolvedTargets.length === 0
  ) {
    lines.push("No se detectaron incidencias.", "");
  }

  return lines.join("\n");
}

async function main() {
  const [teiXml, notesXml] = await Promise.all([
    fs.readFile(teiPath, "utf8"),
    fs.readFile(notesPath, "utf8"),
  ]);

  const teiIds = new Set([...teiXml.matchAll(/xml:id="([^"]+)"/g)].map((match) => match[1]));
  const actOneBlock = extractActOneBlock(notesXml);
  const parsedNotes = parseNotes(actOneBlock);

  const targetFixes = [];
  const categoryFixes = [];
  const unresolvedTargets = [];

  const rows = parsedNotes.map((note) => {
    const normalizedType = normalizeCategory(note.type);
    const normalizedSubtype = normalizeCategory(note.subtype);
    const normalizedTarget = normalizeTarget(note.target, teiIds);

    if (normalizedType !== normalizeWhitespace(note.type).toLowerCase()) {
      categoryFixes.push({
        nota_id: note.nota_id,
        field: "type",
        from: note.type,
        to: normalizedType,
      });
    }

    if (normalizedSubtype && normalizedSubtype !== normalizeWhitespace(note.subtype).toLowerCase()) {
      categoryFixes.push({
        nota_id: note.nota_id,
        field: "subtype",
        from: note.subtype,
        to: normalizedSubtype,
      });
    }

    normalizedTarget.changes.forEach((change) => {
      targetFixes.push({
        nota_id: note.nota_id,
        from: `#${change.from}`,
        to: `#${change.to}`,
      });
    });

    normalizedTarget.missing.forEach((missingTarget) => {
      unresolvedTargets.push({
        nota_id: note.nota_id,
        target: `#${missingTarget}`,
      });
    });

    return {
      nota_id: note.nota_id,
      target: normalizedTarget.target,
      version: Number(note.version || "1.0"),
      active: true,
      type: normalizedType,
      subtype: normalizedSubtype,
      texto_nota: note.texto_nota,
    };
  });

  const requiredMissing = rows.filter(
    (row) => !row.nota_id || !row.target || !row.type || !row.texto_nota
  );
  if (requiredMissing.length > 0) {
    throw new Error(`Hay ${requiredMissing.length} notas sin campos obligatorios tras la normalizacion.`);
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  await fs.writeFile(csvPath, `${toCsv(rows)}\n`, "utf8");
  await fs.writeFile(
    warningsPath,
    toWarningsMarkdown({
      noteCount: rows.length,
      targetFixes,
      categoryFixes,
      unresolvedTargets,
    }),
    "utf8"
  );

  console.log(`Notas exportadas (acto I): ${rows.length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Warnings: ${warningsPath}`);
  console.log(`Targets normalizados: ${targetFixes.length}`);
  console.log(`Categorias normalizadas: ${categoryFixes.length}`);
  console.log(`Targets sin resolver: ${unresolvedTargets.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
