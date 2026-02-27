# Incidencias upload + cleanup (operacion)

Guia de diagnostico para el pipeline documental:

1. `issue-upload-token`
2. upload Apps Script
3. `finalize-document-upload`
4. `cancel-document-upload`
5. `cleanup-stale-uploads`

## Diagnostico rapido por etapa

## A) `issue-upload-token` falla

Errores comunes:

1. `invalid_session_id` / `session_not_found`
2. `recaptcha_invalid`
3. `missing_upload_token_secret`
4. `staging_not_reusable` / `staging_expired`

Checks:

1. Verificar sesion activa en frontend (`window.Participacion.session.getState()`).
2. Confirmar `RECAPTCHA_SECRET` en Edge Functions (entornos no localhost).
3. Confirmar `UPLOAD_TOKEN_SECRET` en variables de funcion.

## B) Upload Apps Script falla

Errores comunes:

1. `missing_file`
2. `invalid_upload_token`
3. `file_too_large`
4. `invalid_mime`
5. `NetworkError` / CORS/preflight

Checks:

1. Apps Script desplegado como Web App (acceso correcto).
2. Script Properties:
1. `UPLOAD_TOKEN_SECRET`
2. `APPS_SCRIPT_SHARED_SECRET`
3. El frontend usa `multipart/form-data` (no JSON directo en navegador para upload).

## C) `finalize-document-upload` falla

Errores comunes:

1. `invalid_receipt`
2. `staging_not_found`
3. `staging_forbidden`
4. `staging_expired`
5. `max_files_exceeded`

Checks:

1. `APPS_SCRIPT_SHARED_SECRET` coincide entre Apps Script y Edge.
2. `staging_id` pertenece a `session_id`.
3. Archivos cumplen limites de MIME/tamano.

## D) `cancel-document-upload` falla

Errores comunes:

1. `staging_not_found`
2. `staging_forbidden`
3. `apps_script_delete_failed` (best effort)

Checks:

1. Validar ownership de sesion.
2. Si falla delete en Apps Script, dejar que `cleanup-stale-uploads` procese.

## E) `cleanup-stale-uploads` falla

Errores comunes:

1. HTTP != 2xx
2. respuesta con `metrics.cleanup_failed > 0`
3. respuesta con `metrics.failed > 0`

Checks:

1. Secret de workflow `CLEANUP_JOB_SECRET` correcto.
2. Funcion accesible en `SUPABASE_URL/functions/v1/cleanup-stale-uploads`.
3. Revisar logs de funcion en Supabase.

## Consultas SQL operativas

## 1) Staging activo por estado

```sql
select status, count(*) as total
from public.contribuciones_upload_staging
group by status
order by status;
```

## 2) Staging atascado (expirado no limpiado)

```sql
select staging_id, status, updated_at, expires_at, cleanup_attempts, last_error
from public.contribuciones_upload_staging
where status in ('issued', 'uploading', 'uploaded', 'cancelled', 'cleanup_failed')
  and expires_at < now()
order by updated_at asc;
```

## 3) Ultimos `cleanup_failed`

```sql
select staging_id, status, cleanup_attempts, last_error, updated_at
from public.contribuciones_upload_staging
where status = 'cleanup_failed'
order by updated_at desc
limit 50;
```

## Recuperacion manual de staging atascado

1. Intentar limpieza manual via endpoint `cleanup-stale-uploads` (`workflow_dispatch`).
2. Si persiste `cleanup_failed`, borrar en Drive manualmente los `drive_file_id`.
3. Marcar estado a `expired` para permitir purge posterior:

```sql
update public.contribuciones_upload_staging
set status = 'expired',
    last_error = null,
    updated_at = now()
where staging_id = '<staging_uuid>';
```

## Interpretacion de alerta en workflow cleanup

El workflow falla por politica si:

1. `metrics.cleanup_failed > CLEANUP_FAIL_THRESHOLD`
2. `metrics.failed > CLEANUP_FAIL_THRESHOLD`

Default:

1. `CLEANUP_FAIL_THRESHOLD=0`

Accion:

1. Revisar respuesta JSON del job en `GITHUB_STEP_SUMMARY`.
2. Ejecutar consultas SQL de este documento.
3. Corregir secreto/conectividad/Apps Script segun causa.
