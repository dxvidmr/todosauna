# Rotacion de secretos (operacion)

Este runbook define como rotar secretos sin interrumpir flujos de participacion y upload.

## Inventario de secretos

## Frontend runtime (publicos)

1. `SUPABASE_URL`
2. `SUPABASE_PUBLISHABLE_KEY`
3. `GEONAMES_USERNAME`
4. `RECAPTCHA_SITE_KEY`

## Backend / Edge Functions (privados)

1. `SUPABASE_SERVICE_ROLE_KEY`
2. `RECAPTCHA_SECRET`
3. `UPLOAD_TOKEN_SECRET`
4. `APPS_SCRIPT_SHARED_SECRET`
5. `APPS_SCRIPT_URL`
6. `CLEANUP_JOB_SECRET`

## GitHub Actions (privados)

1. `SUPABASE_URL`
2. `CLEANUP_JOB_SECRET`
3. (si aplica) secretos E2E no dummy

## Secuencia recomendada

## 1) Preparar nuevos valores

1. Generar nuevos secretos fuertes.
2. Guardar temporalmente en un vault seguro.

## 2) Rotar en backend primero

1. Actualizar variables en Supabase Edge Functions.
2. Si aplica Apps Script, actualizar Script Properties:
1. `UPLOAD_TOKEN_SECRET`
2. `APPS_SCRIPT_SHARED_SECRET`
3. Publicar nueva version del script web app.

## 3) Rotar en CI

1. Actualizar secrets de GitHub Actions.
2. Ejecutar `cleanup-stale-uploads` manual (`workflow_dispatch`) para validar auth.

## 4) Rotar frontend/publicos

1. Actualizar variables de build/runtime del sitio.
2. Desplegar.

## 5) Validacion post-rotacion

1. Flujo testimonio: envio correcto.
2. Flujo contribucion staged:
1. `issue-upload-token`
2. upload a Apps Script
3. `finalize-document-upload`
4. submit final.
3. `cleanup-stale-uploads` devuelve `ok=true` y sin `cleanup_failed`.
4. `npm run test:e2e:ci` en verde.

## Politica de emergencia

Si falla la rotacion:

1. Revertir inmediatamente a secretos previos (si siguen vigentes).
2. Ejecutar checklist de validacion.
3. Abrir incidencia con fecha, alcance y causa raiz.
