import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const inventoryPath = path.join(repoRoot, 'docs', 'architecture', 'collectionbuilder-inventory.md');

const EXACT_DIRECTORIES = {
  '_includes/feature': [
    'accordion.html',
    'alert.html',
    'audio-modal.html',
    'audio.html',
    'blockquote.html',
    'button.html',
    'card.html',
    'cloud.html',
    'collapse.html',
    'gallery.html',
    'icon.html',
    'image.html',
    'jumbotron.html',
    'mini-map.html',
    'modal.html',
    'nav-menu.html',
    'pdf.html',
    'timelinejs.html',
    'video-modal.html',
    'video.html'
  ],
  '_layouts/item': [
    'audio.html',
    'compound_object.html',
    'image.html',
    'item-page-base.html',
    'item-page-full-width.html',
    'item.html',
    'multiple.html',
    'panorama.html',
    'pdf.html',
    'record.html',
    'video.html'
  ],
  '_includes/cb': [
    'jekyll-toc.html'
  ],
  '_plugins': [
    'array_count_uniq.rb',
    'cb_helpers.rb',
    'cb_page_gen.rb'
  ]
};

const REQUIRED_PATHS = [
  'README-CB.md',
  '_data/CB-Fuenteovejuna-metadata.csv',
  'data-archive/README.md',
  'data-archive/prueba-CB-Fuenteovejuna-metadata.csv',
  'data-archive/Supabase Snippet Public Testimonials with Privacy-Aware Fields.csv',
  '_layouts/home-infographic.html',
  '_includes/collection-banner.html',
  '_includes/scroll-to-top.html',
  'rakelib/deploy.rake'
];

const REMOVED_PATHS = [
  'pages/about-cb.md',
  '_includes/cb/about_the_about.md',
  '_includes/cb/credits.html',
  '_includes/cb/feature_options.md',
  '_data/demo-metadata.csv',
  '_data/demo-compoundobjects-metadata.csv',
  '_data/demo-compoundobjects-allmedia.csv'
];

const REMOVED_OBJECT_PATTERN = /^(?:demo_|210|hells_half_theta|hughes_article)/;

const REQUIRED_DOCUMENT_MARKERS = [
  '`crítico`',
  '`adaptado`',
  '`reutilizable`',
  '`demo`',
  '`referencia`',
  '`propio`',
  'git restore --source=c3a6220',
  'github.com/CollectionBuilder/collectionbuilder-csv'
];

function listFiles(relativeDir) {
  const absoluteDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(absoluteDir)) return null;
  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function compareDirectory(relativeDir, expectedFiles, violations) {
  const actualFiles = listFiles(relativeDir);
  if (!actualFiles) {
    violations.push(`${relativeDir}: falta el directorio inventariado`);
    return;
  }

  const expected = [...expectedFiles].sort();
  const missing = expected.filter((name) => !actualFiles.includes(name));
  const unexpected = actualFiles.filter((name) => !expected.includes(name));

  if (missing.length) violations.push(`${relativeDir}: faltan ${missing.join(', ')}`);
  if (unexpected.length) violations.push(`${relativeDir}: hay archivos sin inventariar: ${unexpected.join(', ')}`);
}

function main() {
  const violations = [];

  if (!fs.existsSync(inventoryPath)) {
    violations.push('falta docs/architecture/collectionbuilder-inventory.md');
  } else {
    const inventory = fs.readFileSync(inventoryPath, 'utf8');
    for (const marker of REQUIRED_DOCUMENT_MARKERS) {
      if (!inventory.includes(marker)) violations.push(`el inventario no contiene el marcador ${marker}`);
    }
  }

  for (const [relativeDir, expectedFiles] of Object.entries(EXACT_DIRECTORIES)) {
    compareDirectory(relativeDir, expectedFiles, violations);
  }

  for (const relativePath of REQUIRED_PATHS) {
    if (!fs.existsSync(path.join(repoRoot, relativePath))) {
      violations.push(`${relativePath}: falta la ruta registrada`);
    }
  }

  for (const relativePath of REMOVED_PATHS) {
    if (fs.existsSync(path.join(repoRoot, relativePath))) {
      violations.push(`${relativePath}: reapareció una ruta demo retirada`);
    }
  }

  const objectsDir = path.join(repoRoot, 'objects');
  if (fs.existsSync(objectsDir)) {
    const pending = [];
    const visit = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(fullPath);
        else if (REMOVED_OBJECT_PATTERN.test(entry.name)) pending.push(path.relative(repoRoot, fullPath).replace(/\\/g, '/'));
      }
    };
    visit(objectsDir);
    if (pending.length) violations.push(`objetos demo retirados que han reaparecido: ${pending.join(', ')}`);
  }

  if (!violations.length) {
    console.log('OK: el legado de CollectionBuilder coincide con el inventario documentado.');
    return;
  }

  console.error('ERROR: cambió una superficie de CollectionBuilder sin actualizar el inventario:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

main();
