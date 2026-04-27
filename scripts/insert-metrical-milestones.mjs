import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const xmlPath = path.join(repoRoot, "assets", "data", "tei", "fuenteovejuna.xml");

const metricalSections = [
  { start: 1, end: 68, ana: "#redondilla" },
  { start: 69, end: 140, ana: "#romance #rima-ao" },
  { start: 141, end: 456, ana: "#redondilla" },
  { start: 457, end: 528, ana: "#romance #rima-ee" },
  { start: 529, end: 544, ana: "#romancillo #rima-oe" },
  { start: 545, end: 578, ana: "#terceto-encadenado #remate-cuarteto" },
  { start: 579, end: 590, ana: "#redondilla" },
  { start: 591, end: 594, ana: "#romancillo #rima-oe" },
  { start: 595, end: 654, ana: "#redondilla" },
  { start: 655, end: 698, ana: "#romance #rima-eo" },
  { start: 699, end: 722, ana: "#redondilla" },
  { start: 723, end: 860, ana: "#romance #rima-oo" },
  { start: 861, end: 940, ana: "#octava-real" },
  { start: 941, end: 1104, ana: "#redondilla" },
  { start: 1105, end: 1138, ana: "#romance #rima-ea" },
  { start: 1139, end: 1450, ana: "#redondilla" },
  { start: 1451, end: 1473, ana: "#endecasilabo-suelto #pareado" },
  { start: 1474, end: 1476, ana: "#estribillo" },
  { start: 1477, end: 1504, ana: "#redondilla" },
  { start: 1505, end: 1511, ana: "#copla #estribillo" },
  { start: 1512, end: 1547, ana: "#redondilla" },
  { start: 1548, end: 1571, ana: "#romance #rima-oe #con-estribillo" },
  { start: 1572, end: 1653, ana: "#romance #rima-ae" },
  { start: 1654, end: 1713, ana: "#terceto-encadenado" },
  { start: 1714, end: 1849, ana: "#romance #rima-oe" },
  { start: 1850, end: 1921, ana: "#octava-real" },
  { start: 1922, end: 1949, ana: "#redondilla" },
  { start: 1950, end: 2029, ana: "#romance #rima-ee" },
  { start: 2030, end: 2032, ana: "#estribillo" },
  { start: 2033, end: 2036, ana: "#redondilla" },
  { start: 2037, end: 2044, ana: "#copla-arte-menor" },
  { start: 2045, end: 2048, ana: "#redondilla" },
  { start: 2049, end: 2055, ana: "#copla-arte-menor" },
  { start: 2056, end: 2058, ana: "#estribillo" },
  { start: 2059, end: 2062, ana: "#redondilla" },
  { start: 2063, end: 2069, ana: "#copla-arte-menor" },
  { start: 2070, end: 2070, ana: "#estribillo" },
  { start: 2071, end: 2162, ana: "#redondilla" },
  { start: 2163, end: 2176, ana: "#soneto" },
  { start: 2177, end: 2456, ana: "#redondilla" }
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function insertMilestones(xml) {
  let output = xml;
  const notFound = [];
  const alreadyPresent = [];
  let inserted = 0;

  for (const section of metricalSections) {
    const nValue = `${section.start}-${section.end}`;
    const milestone = `<milestone unit="metrical-section" n="${nValue}" ana="${section.ana}"/>`;

    if (output.includes(milestone)) {
      alreadyPresent.push(nValue);
      continue;
    }

    const lineStartRegex = new RegExp(
      `^([\\t ]*)<l\\b(?=[^>]*\\bn="${escapeRegExp(String(section.start))}")[^>]*>`,
      "m"
    );

    const match = output.match(lineStartRegex);
    if (!match || typeof match.index !== "number") {
      notFound.push(section.start);
      continue;
    }

    const indent = match[1] ?? "";
    const insertion = `${indent}${milestone}\n`;
    output = `${output.slice(0, match.index)}${insertion}${output.slice(match.index)}`;
    inserted += 1;
  }

  return { output, inserted, notFound, alreadyPresent };
}

async function main() {
  const originalXml = await fs.readFile(xmlPath, "utf8");
  const { output, inserted, notFound, alreadyPresent } = insertMilestones(originalXml);

  if (notFound.length > 0) {
    throw new Error(`No se encontró <l> para n=${notFound.join(", ")}.`);
  }

  if (output !== originalXml) {
    await fs.writeFile(xmlPath, output, "utf8");
  }

  console.log(`Milestones insertados: ${inserted}`);
  console.log(`Milestones ya presentes: ${alreadyPresent.length}`);
  console.log(`Archivo actualizado: ${xmlPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
