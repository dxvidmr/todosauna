# Todos a una

Portal digital de investigación, participación y difusión en torno a *Fuenteovejuna*.

Este repositorio contiene el sitio web público (Jekyll + CollectionBuilder como base), la capa de participación en frontend, y el backend de participación en Supabase (migraciones SQL, RPC, etc.).

## Qué incluye este proyecto

- Lectura digital.
- Archivo digital.
- Otros recursos educativos y de divulgación de la obra.
- Flujos de participación:
  - evaluación de notas y sugerencias,
  - envío de testimonios,
  - envío de documentos (con pipeline de subida).
- Modo anónimo y modo colaborador.
- Política pública de privacidad en `/privacidad/`.
- Suite E2E (Playwright) para smoke tests críticos.

## Stack técnico

- **Web**: Jekyll / CollectionBuilder (base), HTML/Liquid, SCSS, JS.
- **Participación**: frontend modular en `assets/js/participacion`.
- **Datos**: Supabase (Postgres + RPC + migraciones).
- **Subida documental**: Edge Functions + Apps Script/Google Drive.
- **Testing**: Playwright (`tests/e2e`).

## Estructura clave del repo

- `_config.yml`: configuración general del sitio.
- `pages/`: páginas públicas.
- `_includes/participacion/`: plantillas UI de participación.
- `assets/js/participacion/`: lógica de sesión, modal, formularios y API.
- `supabase/migrations/`: historial de migraciones SQL.
- `docs/`: documentación funcional y operativa (de CB y propia).
- `tests/e2e/`: smoke tests E2E.

## Requisitos

- Ruby + Bundler (Jekyll).
- Node.js 20+ y npm.
- Docker Desktop (para Supabase local).

## Puesta en marcha local

### 1) Sitio web

```bash
bundle install
bundle exec jekyll serve
```

Sitio local por defecto: `http://127.0.0.1:4000`.

### 2) Supabase local

En este proyecto no se asume `supabase` global. Se usa CLI por `npx` (igual que en CI):

```bash
npx --yes supabase@2.76.15 --version
npx --yes supabase@2.76.15 start -x vector,logflare
npx --yes supabase@2.76.15 db reset
```

Si necesitas aplicar migraciones en remoto:

```bash
npx --yes supabase@2.76.15 db push
```

### 3) Tests E2E

```bash
npm install
npx playwright install chromium
npm run check:no-legacy-runtime
npm run test:e2e
```

También disponibles:

- `npm run test:e2e:headed`
- `npm run test:e2e:ci`

## Flujo recomendado de migraciones

1. Crear migración nueva.
2. Validar con `db reset` local.
3. Revisar sincronía con `migration list`.
4. Aplicar con `db push` en entorno objetivo.

Referencia detallada: `docs/migraciones-playbook.md`.

## Privacidad y protección de datos

- Política pública para usuarios: `/privacidad/` (`pages/privacidad.md`).
- Mapa técnico de tratamientos: `docs/proteccion-datos-mapa.md`.
- Documento de soporte PD/UAB: `docs/PD-UAB.md`.

## Documentación útil

- `docs/testing-e2e.md`
- `docs/build.md`
- `docs/analytics.md`

## Nota sobre CollectionBuilder

Este proyecto parte de `collectionbuilder-csv`, pero está ampliamente adaptado.
El README original de CollectionBuilder se conserva en `README-CB.md`.
