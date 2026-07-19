import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const TARGETS = ['_includes', '_layouts', '_sass', 'pages', 'assets/js', '_config.yml'];
const ALLOWED_EXTENSIONS = new Set(['.html', '.js', '.liquid', '.md', '.mjs', '.scss', '.yml', '.yaml']);

const RULES = [
  {
    id: 'removed_color_source',
    description: 'Referencia a una fuente cromática eliminada',
    pattern: /config-theme-colors|_theme-colors|lectura-variables|_variables\.scss/
  },
  {
    id: 'bootstrap_color_button',
    description: 'Variante cromática Bootstrap sustituida por una variante semántica',
    pattern: /\bbtn(?:-outline)?-(?:primary|secondary|dark|light)\b/
  },
  {
    id: 'artificial_color_scale',
    description: 'Nombre de la antigua escala cromática artificial',
    pattern: /\bsecondary-(?:50|100|200)\b|\btext-neutral-700\b/
  },
  {
    id: 'removed_css_color_property',
    description: 'Propiedad CSS cromática antigua',
    pattern: /--(?:primary|secondary)-color\b/
  }
];

function collectFiles(target, files) {
  const absolute = path.join(repoRoot, target);
  if (!fs.existsSync(absolute)) return;

  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    files.push(absolute);
    return;
  }

  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const fullPath = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      collectFiles(path.relative(repoRoot, fullPath), files);
      continue;
    }
    if (ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
}

function main() {
  const files = [];
  TARGETS.forEach((target) => collectFiles(target, files));
  const violations = [];

  for (const filePath of files) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (!rule.pattern.test(line)) continue;
        violations.push({
          file: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
          line: index + 1,
          ...rule,
          text: line.trim()
        });
      }
    });
  }

  if (!violations.length) {
    console.log('OK: el runtime usa exclusivamente la nomenclatura cromática semántica.');
    return;
  }

  console.error('ERROR: se detectaron restos del sistema de color eliminado:');
  violations.forEach((violation) => {
    console.error(`- [${violation.id}] ${violation.file}:${violation.line} -> ${violation.text}`);
  });
  process.exit(1);
}

main();
