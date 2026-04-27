import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const xmlPath = path.join(repoRoot, "assets", "data", "tei", "fuenteovejuna.xml");

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAnaTokens(ana) {
  return String(ana || "")
    .split(/\s+/)
    .map((token) => token.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function extractMetricalSections(xml) {
  const sections = [];
  const sectionRegex = /<milestone\b(?=[^>]*\bunit="metrical-section")(?=[^>]*\bn="(\d+)-(\d+)")(?=[^>]*\bana="([^"]*)")[^>]*\/>/g;

  let match;
  while ((match = sectionRegex.exec(xml)) !== null) {
    sections.push({
      start: Number(match[1]),
      end: Number(match[2]),
      ana: match[3]
    });
  }

  return sections;
}

function chunkStarts(start, end, chunkSize) {
  const starts = [];
  for (let current = start; current <= end; current += chunkSize) {
    starts.push(current);
  }
  return starts;
}

function onlyIfHasInternalBreaks(starts) {
  // Si no hay cortes internos, no se inserta ni la primera estrofa.
  return starts.length > 1 ? starts : [];
}

function stanzaStartsForSection(section, warnings) {
  const { start, end } = section;
  const length = end - start + 1;
  const anaTokens = normalizeAnaTokens(section.ana);
  const has = (name) => anaTokens.includes(name);

  if (has("redondilla")) {
    return onlyIfHasInternalBreaks(chunkStarts(start, end, 4));
  }

  if (has("octava-real")) {
    return onlyIfHasInternalBreaks(chunkStarts(start, end, 8));
  }

  if (has("terceto-encadenado")) {
    if (length % 3 === 0) {
      return onlyIfHasInternalBreaks(chunkStarts(start, end, 3));
    }

    if (length > 4 && (length - 4) % 3 === 0) {
      const starts = [start];
      let current = start;
      let remaining = length;

      while (remaining > 4) {
        current += 3;
        remaining -= 3;
        starts.push(current);
      }

      return onlyIfHasInternalBreaks(starts);
    }

    warnings.push(
      `Seccion ${start}-${end} (#terceto-encadenado) con longitud ${length} no compatible con 3/3/.../4; se deja sin subdividir.`
    );
    return [];
  }

  if (has("soneto")) {
    if (length === 14) {
      return [start, start + 4, start + 8, start + 11];
    }

    warnings.push(
      `Seccion ${start}-${end} (#soneto) con longitud ${length} distinta de 14; se deja sin subdividir.`
    );
    return [];
  }

  return [];
}

function collectStanzaStarts(sections) {
  const warnings = [];
  const starts = [];

  sections.forEach((section) => {
    starts.push(...stanzaStartsForSection(section, warnings));
  });

  const uniqueSorted = Array.from(new Set(starts)).sort((a, b) => a - b);
  return { starts: uniqueSorted, warnings };
}

function removeExistingStanzaMilestones(xml) {
  // Elimina solo stanzas automaticas "planas" y conserva stanzas manuales con atributos (ej. ana="#pareado-final").
  return xml.replace(/^[\t ]*<milestone\s+unit="stanza"\s*\/>(?:\s*)\r?\n/gm, "");
}

function hasAnyStanzaBeforeStart(xml, start) {
  const pattern = new RegExp(
    `<milestone\\b(?=[^>]*\\bunit="stanza")[^>]*\\/>\\s*\\r?\\n[\\t ]*<l\\b(?=[^>]*\\bn="${escapeRegExp(String(start))}")[^>]*>`,
    "m"
  );
  return pattern.test(xml);
}

function insertStanzaMilestones(xml, starts) {
  let output = xml;
  const notFound = [];
  const alreadyPresent = [];
  let inserted = 0;

  starts.forEach((start) => {
    if (hasAnyStanzaBeforeStart(output, start)) {
      alreadyPresent.push(start);
      return;
    }

    const lineStartRegex = new RegExp(
      `^([\\t ]*)<l\\b(?=[^>]*\\bn="${escapeRegExp(String(start))}")[^>]*>`,
      "m"
    );

    const match = output.match(lineStartRegex);
    if (!match || typeof match.index !== "number") {
      notFound.push(start);
      return;
    }

    const indent = match[1] ?? "";
    const insertion = `${indent}<milestone unit="stanza"/>\n`;
    output = `${output.slice(0, match.index)}${insertion}${output.slice(match.index)}`;
    inserted += 1;
  });

  return { output, inserted, notFound, alreadyPresent };
}

async function main() {
  const originalXml = await fs.readFile(xmlPath, "utf8");
  const cleanedXml = removeExistingStanzaMilestones(originalXml);
  const metricalSections = extractMetricalSections(cleanedXml);

  if (metricalSections.length === 0) {
    throw new Error("No se encontraron milestones de metrical-section en el XML.");
  }

  const { starts, warnings } = collectStanzaStarts(metricalSections);
  const { output, inserted, notFound, alreadyPresent } = insertStanzaMilestones(cleanedXml, starts);

  if (notFound.length > 0) {
    throw new Error(`No se encontro <l> para n=${notFound.join(", ")}.`);
  }

  if (output !== originalXml) {
    await fs.writeFile(xmlPath, output, "utf8");
  }

  console.log(`Secciones metricas leidas: ${metricalSections.length}`);
  console.log(`Inicios de estrofa calculados: ${starts.length}`);
  console.log(`Milestones de estrofa insertados: ${inserted}`);
  console.log(`Milestones de estrofa ya presentes: ${alreadyPresent.length}`);
  console.log(`Archivo actualizado: ${xmlPath}`);

  if (warnings.length > 0) {
    console.log("Warnings:");
    warnings.forEach((warning) => console.log(`- ${warning}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
