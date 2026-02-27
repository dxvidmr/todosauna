import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const TARGETS = [
  '_includes',
  '_layouts',
  'pages',
  path.join('assets', 'js')
];

const ALLOWED_EXTENSIONS = new Set(['.html', '.js', '.md', '.liquid']);

const RULES = [
  {
    id: 'legacy_file_reference',
    description: 'Referencias a archivos legacy eliminados',
    pattern:
      /legacy-bridge\.js|user-manager\.js|modal-modo\.js|lectura\/supabase-api\.js|lectura\/config\.js|lectura\/supabase-client\.js/
  },
  {
    id: 'legacy_global_reference',
    description: 'Referencias a globales legacy',
    pattern: /window\.SUPABASE_CONFIG|window\.supabaseClient|window\.SupabaseAPI|window\.userManager|window\.modalModo/
  }
];

function walk(dirPath, result) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, result);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    result.push(fullPath);
  }
}

function findMatches(filePath, content, rule) {
  const matches = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!rule.pattern.test(line)) continue;
    matches.push({
      line: index + 1,
      text: line.trim()
    });
  }

  return matches;
}

function main() {
  const files = [];
  for (const target of TARGETS) {
    const full = path.join(repoRoot, target);
    if (!fs.existsSync(full)) continue;
    walk(full, files);
  }

  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rule of RULES) {
      const matches = findMatches(filePath, content, rule);
      for (const match of matches) {
        violations.push({
          file: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
          line: match.line,
          id: rule.id,
          description: rule.description,
          text: match.text
        });
      }
    }
  }

  if (!violations.length) {
    console.log('OK: no hay referencias legacy en runtime activo.');
    return;
  }

  console.error('ERROR: se detectaron referencias legacy en runtime activo:');
  for (const v of violations) {
    console.error(`- [${v.id}] ${v.file}:${v.line} -> ${v.text}`);
  }

  process.exit(1);
}

main();
