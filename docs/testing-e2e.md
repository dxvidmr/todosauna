# Testing E2E (F10.1)

Esta guía define el smoke E2E local/CI para los flujos críticos de participación.

## Prerrequisitos

- Docker Desktop en ejecución.
- Supabase CLI (`npx supabase ...`).
- Ruby + Bundler (para `bundle exec jekyll serve`).
- Node.js 20+ y npm.

## Qué cubre el smoke

1. Bootstrap de sesión global y reutilización de token.
2. Lectura: primera contribución libre y modal en segunda.
3. Envío de testimonio.
4. Envío de contribución documental staged:
   - upload mock de Apps Script,
   - `finalize-document-upload` real,
   - submit final real.

## Comandos

Instalación:

```bash
npm install
npx playwright install chromium
```

Ejecución local:

```bash
npm run test:e2e
```

Ejecución local con navegador visible:

```bash
npm run test:e2e:headed
```

Modo CI local:

```bash
npm run test:e2e:ci
```

Chequeo anti-legacy runtime:

```bash
npm run check:no-legacy-runtime
```

## Configuración E2E usada

- Playwright: `playwright.config.ts`
- Override Jekyll: `tests/e2e/_config.e2e.yml`
- Env de Edge Functions: `tests/e2e/env.functions.e2e`

Notas:

1. La suite levanta Supabase local con `-x vector,logflare` para evitar inestabilidad del servicio de analytics en local/CI.
2. reCAPTCHA se desactiva en E2E (`site key` vacío) y el bypass de verificación se habilita solo en localhost (`UPLOAD_DEV_BYPASS_RECAPTCHA=true`).
3. No se usa Apps Script real; el upload HTTP se mockea en Playwright.
4. En CI se usa Supabase CLI pinneado (`2.76.15`) via `npx` para evitar fallos transitorios de setup.
5. Antes de Playwright, CI ejecuta `npm run check:no-legacy-runtime` para bloquear regresiones de F11.
6. El runtime frontend first-party (`assets/js`) se carga via `type="module"` con entrypoints por página.
7. `check:no-legacy-runtime` también valida que no se reintroduzcan tags `<script src=\"/assets/js/...\">` sin `type=\"module\"`.

## Troubleshooting

### `supabase_analytics_* unhealthy` al arrancar

Usar exclusión de `logflare` (ya configurado en la suite):

```bash
npx supabase start -x vector,logflare
```

### Puerto ocupado en `54321` o `4000`

1. Cierra procesos previos de Jekyll/Supabase.
2. Ejecuta:

```bash
npx supabase stop --all --no-backup
```

3. Reintenta `npm run test:e2e`.

### Edge Functions no responden

Verifica que `tests/e2e/env.functions.e2e` existe y contiene:

- `UPLOAD_TOKEN_SECRET`
- `APPS_SCRIPT_SHARED_SECRET`

Nota:
- Este archivo contiene solo credenciales dummy de test (versionadas).
- No debe contener secretos productivos.

Notas:

1. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se inyectan desde `tests/e2e/run-e2e-stack.js` (no van en `--env-file` porque `supabase functions serve` bloquea claves `SUPABASE_*` en archivo).
2. Jekyll E2E sirve en `http://127.0.0.1:4010`.
3. El comando de CLI en runner E2E se controla con `SUPABASE_CLI_CMD` (por defecto `npx --yes supabase@2.76.15`).

### Fallo de subida staged en E2E

1. Comprueba que la ruta mock de Apps Script responde con `receipt` firmado.
2. Verifica que el secreto de firma coincida en:
   - `tests/e2e/env.functions.e2e`
   - `tests/e2e/helpers/constants.ts`
