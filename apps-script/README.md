# Apps Script Setup

Use `apps-script/drive_upload_gateway.gs` as the code for your Google Apps Script web app.

## 1) Create script

1. Create a new Apps Script project.
2. Create a file named `drive_upload_gateway.gs`.
3. Copy/paste the content from this repository file:
   - `apps-script/drive_upload_gateway.gs`

## 2) Set Script Properties

In **Project Settings -> Script properties**, add:

- `UPLOAD_TOKEN_SECRET`
- `APPS_SCRIPT_SHARED_SECRET`
- `APPS_SCRIPT_UPLOAD_FOLDER_ID` (optional, recommended)

Important:
- `UPLOAD_TOKEN_SECRET` must match Supabase Edge secret `UPLOAD_TOKEN_SECRET`.
- `APPS_SCRIPT_SHARED_SECRET` must match Supabase Edge secret `APPS_SCRIPT_SHARED_SECRET`.

## 3) Deploy web app

1. Click **Deploy -> New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone** (or equivalent that allows your frontend and Supabase edge calls).
5. Copy the deployment URL and set it in:
   - `.env` -> `APPS_SCRIPT_URL`
   - `_config.yml` -> `apps_script_url`

If you update the script later, create a new deployment version and update URL if needed.

## 4) Quick checks

1. Upload from `/participa/documentos/enviar/` should return a staged file list.
2. Cancel upload should remove staged files (`cancel-document-upload`).
3. Cleanup cron should work with `CLEANUP_JOB_SECRET`.
