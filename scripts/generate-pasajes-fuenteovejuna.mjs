import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const xmlPath = path.join(repoRoot, "assets", "data", "tei", "fuenteovejuna.xml");
const outDir = path.join(repoRoot, "supabase", "data");
const jsonPath = path.join(outDir, "pasajes_fuenteovejuna.json");
const csvPath = path.join(outDir, "pasajes_fuenteovejuna_import.csv");
const warningsPath = path.join(outDir, "pasajes_fuenteovejuna_warnings.md");

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function extractComments(lines) {
  const comments = [];
  let currentAct = null;

  for (let i = 0; i < lines.length; i += 1) {
    const actMatch = lines[i].match(/<div type="act" n="(\d+)">/);
    if (actMatch) currentAct = Number(actMatch[1]);

    const passageMatch = lines[i].match(/<!--\s*PASAJE\s+(\d+)/);
    if (!passageMatch) continue;

    const orden = Number(passageMatch[1]);
    let title = "";
    let description = "";
    let mode = null;
    let j = i + 1;

    while (j < lines.length) {
      const trimmed = lines[j].trim();
      if (trimmed.includes("-->")) break;

      const titleMatch = trimmed.match(/^t[ií]tulo:\s*(.*)$/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
        mode = "title";
        j += 1;
        continue;
      }

      const descMatch = trimmed.match(/^descripci[oó]n:\s*(.*)$/i);
      if (descMatch) {
        description = descMatch[1].trim();
        mode = "description";
        j += 1;
        continue;
      }

      if (trimmed) {
        if (mode === "title") {
          title = `${title} ${trimmed}`.trim();
        } else if (mode === "description") {
          description = `${description} ${trimmed}`.trim();
        }
      }

      j += 1;
    }

    comments.push({
      orden,
      acto: currentAct,
      titulo: title,
      descripcion: description,
      commentStart: i,
      commentEnd: j,
    });
  }

  return comments.sort((a, b) => a.orden - b.orden);
}

function findBoundaries(lines, startLine, endLine, orden, warnings) {
  let inicio = null;
  let fin = null;
  let primerTagSinId = null;
  let ultimoTagSinId = null;

  for (let i = startLine; i <= endLine; i += 1) {
    const line = lines[i];
    const tagRegex = /<(stage|sp|l)\b([^>]*)>/g;
    let match;

    while ((match = tagRegex.exec(line)) !== null) {
      const element = match[1];
      const attrs = match[2] || "";
      const idMatch = attrs.match(/\bxml:id="([^"]+)"/);

      if (!idMatch) {
        if (!inicio && !primerTagSinId) {
          primerTagSinId = { element, line: i + 1 };
        }
        ultimoTagSinId = { element, line: i + 1 };
        continue;
      }

      const candidate = {
        element,
        xmlid: idMatch[1],
        line: i + 1,
      };

      if (!inicio) inicio = candidate;
      fin = candidate;
    }
  }

  if (!inicio || !fin) {
    throw new Error(`No se pudieron resolver inicio/fin para el pasaje ${orden}.`);
  }

  if (primerTagSinId) {
    warnings.push(
      `- Pasaje ${orden}: la primera unidad candidata fue <${primerTagSinId.element}> sin xml:id en la línea ${primerTagSinId.line}; se usó ${inicio.element}#${inicio.xmlid}.`
    );
  }

  if (ultimoTagSinId && ultimoTagSinId.line > fin.line) {
    warnings.push(
      `- Pasaje ${orden}: la última unidad candidata fue <${ultimoTagSinId.element}> sin xml:id en la línea ${ultimoTagSinId.line}; se usó ${fin.element}#${fin.xmlid} como cierre.`
    );
  }

  return { inicio, fin };
}

function buildRows(lines, comments) {
  const warnings = [];
  const rows = comments.map((comment, index) => {
    const nextComment = comments[index + 1];
    const rangeStart = comment.commentEnd + 1;
    const rangeEnd = nextComment ? nextComment.commentStart - 1 : lines.length - 1;
    const { inicio, fin } = findBoundaries(lines, rangeStart, rangeEnd, comment.orden, warnings);

    return {
      id: comment.orden,
      orden: comment.orden,
      inicio_elemento: inicio.element,
      inicio_xmlid: inicio.xmlid,
      fin_elemento: fin.element,
      fin_xmlid: fin.xmlid,
      acto: comment.acto,
      titulo: comment.titulo,
      descripcion: comment.descripcion,
      created_at: null,
      version: 1.0,
      active: true,
    };
  });

  return { rows, warnings };
}

function toCsv(rows) {
  const headers = [
    "orden",
    "inicio_elemento",
    "inicio_xmlid",
    "fin_elemento",
    "fin_xmlid",
    "acto",
    "titulo",
    "descripcion",
    "version",
    "active",
  ];

  const body = rows.map((row) =>
    headers.map((header) => csvEscape(row[header])).join(",")
  );

  return [headers.join(","), ...body].join("\n");
}

function toWarningsMarkdown(warnings) {
  if (warnings.length === 0) {
    return "# Warnings de pasajes\n\nNo se detectaron incidencias de frontera.\n";
  }

  return [
    "# Warnings de pasajes",
    "",
    "Estas incidencias aparecen cuando el comentario cae justo antes o después de una `stage` sin `xml:id`, de modo que el rango exportado usa la siguiente o la anterior unidad válida (`sp`, `l` o `stage` con `xml:id`).",
    "",
    ...warnings,
    "",
  ].join("\n");
}

async function main() {
  const xml = await fs.readFile(xmlPath, "utf8");
  const lines = xml.split(/\r?\n/);
  const comments = extractComments(lines);

  if (comments.length !== 75) {
    throw new Error(`Se esperaban 75 comentarios de pasaje y se encontraron ${comments.length}.`);
  }

  const { rows, warnings } = buildRows(lines, comments);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  await fs.writeFile(csvPath, `${toCsv(rows)}\n`, "utf8");
  await fs.writeFile(warningsPath, toWarningsMarkdown(warnings), "utf8");

  console.log(`Pasajes exportados: ${rows.length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Warnings: ${warningsPath}`);
  console.log(`Incidencias de frontera: ${warnings.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
