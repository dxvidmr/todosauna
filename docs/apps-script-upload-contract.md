# Apps Script Upload Contract

Este documento define el contrato entre el frontend/edge functions y el Apps Script de Google Drive.
Implementacion versionada en este repo:

- `apps-script/drive_upload_gateway.gs`

## Endpoint unico

- `POST <APPS_SCRIPT_URL>`
- Se distingue la operacion con `action`.

## 1) Upload

### Request

- Modo principal:
  - `Content-Type: multipart/form-data`
  - Campos:
    - `action=upload`
    - `upload_token` (token emitido por `issue-upload-token`)
    - `staging_id` (uuid)
    - `file` (binario)
- Modo fallback:
  - `Content-Type: multipart/form-data`
  - Campos:
    - `action=upload`
    - `upload_token`
    - `staging_id`
    - `file_name`
    - `file_mime`
    - `file_size` (opcional)
    - `file_base64` (sin prefijo `data:`)

Nota importante:
- Desde navegador no se usa `application/json` para upload a Apps Script, porque dispara preflight `OPTIONS` y `script.google.com` puede responder `405`.

### Validaciones obligatorias en Apps Script

- Verificar firma y expiracion de `upload_token` con `UPLOAD_TOKEN_SECRET`.
- Verificar coherencia de claims:
  - `staging_id`
  - `session_id`
  - `jti`
  - limites (`max_files`, `max_size_bytes`, `allowed_mime`).
- Validar MIME y tamano del archivo real.

### Response (200)

```json
{
  "ok": true,
  "drive_file_id": "1AbC...",
  "name": "programa-1986.pdf",
  "mime": "application/pdf",
  "size": 245001,
  "receipt": "<signed_receipt>"
}
```

### Error (4xx/5xx)

```json
{
  "ok": false,
  "error": {
    "code": "error_code",
    "message": "mensaje"
  }
}
```

## 2) Delete

### Request

- `Content-Type: application/json`
- Body:

```json
{
  "action": "delete",
  "staging_id": "uuid",
  "file_ids": ["1AbC...", "1Def..."],
  "shared_secret": "<APPS_SCRIPT_SHARED_SECRET>"
}
```

Nota:
- El edge function envia tambien `x-upload-shared-secret` en header por compatibilidad.
- En Apps Script la validacion principal se hace con `shared_secret` en body.

### Response (200)

```json
{
  "ok": true,
  "deleted": ["1AbC..."],
  "not_found": ["1Def..."]
}
```

### Error (4xx/5xx)

```json
{
  "ok": false,
  "error": {
    "code": "error_code",
    "message": "mensaje"
  }
}
```

## Receipt firmado

Cada subida debe devolver `receipt` firmado (HMAC) para validar integridad en `finalize-document-upload`.
Campos minimos recomendados dentro del receipt:

- `staging_id`
- `session_id`
- `drive_file_id`
- `mime`
- `size`
- `iat`
- `exp`

## Notas operativas

- No exponer `UPLOAD_TOKEN_SECRET` ni `APPS_SCRIPT_SHARED_SECRET` en frontend.
- `delete` es best effort: errores se registran y se reintentan via `cleanup-stale-uploads`.
- Script properties requeridas en Apps Script:
  - `UPLOAD_TOKEN_SECRET`
  - `APPS_SCRIPT_SHARED_SECRET`
  - `APPS_SCRIPT_UPLOAD_FOLDER_ID` (opcional)

## Checklist operativo de despliegue (upload staged)

1. Variables configuradas en Supabase Functions:
   - `UPLOAD_TOKEN_SECRET`
   - `APPS_SCRIPT_SHARED_SECRET`
   - `APPS_SCRIPT_URL`
   - `RECAPTCHA_SECRET` (entorno no localhost)
2. Script Properties configuradas en Apps Script:
   - `UPLOAD_TOKEN_SECRET`
   - `APPS_SCRIPT_SHARED_SECRET`
   - `APPS_SCRIPT_UPLOAD_FOLDER_ID` (si aplica carpeta fija)
3. Web App desplegada y URL actualizada en `APPS_SCRIPT_URL`.
4. Prueba manual de exito:
   - `issue-upload-token` -> upload -> `finalize-document-upload` -> submit final.
5. Prueba manual de cancelacion:
   - upload parcial -> `cancel-document-upload` -> estado `cancelled`.
6. Prueba manual de cleanup:
   - staging huerfano -> `cleanup-stale-uploads` -> estado `expired` o `cleanup_failed` trazable.
7. Si falla algun paso, seguir `docs/incidencias-upload-cleanup.md`.
