import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { normalizeUploadedFiles, type UploadedFile, validateUploadedFiles } from "../_shared/file-validation.ts";
import { corsHeaders, errorResponse, isOptions, jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import { verifySignedToken } from "../_shared/token-signing.ts";
import { STAGING_TTL_HOURS, UPLOAD_LIMITS, requireEnv } from "../_shared/upload-config.ts";

type SessionRow = {
  session_id: string;
};

type StagingRow = {
  staging_id: string;
  session_id: string;
  status: string;
  file_count: number;
  files: unknown;
  expires_at: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type StagedFile = {
  drive_file_id: string;
  name: string;
  mime: string;
  size: number;
  receipt: string;
  received_at: string;
};

function normalizeStagedFiles(input: unknown): StagedFile[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        drive_file_id: String(row.drive_file_id || "").trim(),
        name: String(row.name || "").trim(),
        mime: String(row.mime || "").trim().toLowerCase(),
        size: Number(row.size || 0),
        receipt: String(row.receipt || "").trim(),
        received_at: String(row.received_at || "").trim() || new Date().toISOString(),
      };
    })
    .filter((row) => !!row.drive_file_id);
}

function computeTotalBytes(files: StagedFile[]): number {
  return files.reduce((sum, file) => {
    const size = Number(file.size || 0);
    return sum + (Number.isFinite(size) ? size : 0);
  }, 0);
}

async function validateReceipts(
  uploadedFiles: UploadedFile[],
  expectedSessionId: string,
  expectedStagingId: string,
  receiptSecret: string,
): Promise<string | null> {
  for (const file of uploadedFiles) {
    const receiptCheck = await verifySignedToken<Record<string, unknown>>(file.receipt, receiptSecret);
    if (!receiptCheck.valid) {
      return `Receipt inválido para ${file.name}: ${receiptCheck.reason}`;
    }

    const payload = receiptCheck.payload;
    if (String(payload.staging_id || "") !== expectedStagingId) {
      return `Receipt staging_id inválido para ${file.name}`;
    }
    if (String(payload.session_id || "") !== expectedSessionId) {
      return `Receipt session_id inválido para ${file.name}`;
    }
    if (String(payload.drive_file_id || "") !== file.drive_file_id) {
      return `Receipt drive_file_id inválido para ${file.name}`;
    }
    if (String(payload.mime || "").toLowerCase() !== file.mime) {
      return `Receipt mime inválido para ${file.name}`;
    }
    if (Number(payload.size || 0) !== file.size) {
      return `Receipt size inválido para ${file.name}`;
    }
  }

  return null;
}

serve(async (req: Request): Promise<Response> => {
  if (isOptions(req)) {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Método no permitido", 405, "method_not_allowed");
  }

  let body: Record<string, unknown>;
  try {
    body = await parseJsonBody(req);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Body inválido", 400, "invalid_json");
  }

  const sessionId = String(body.session_id || "").trim();
  const stagingId = String(body.staging_id || "").trim();
  const uploadedFiles = normalizeUploadedFiles(body.uploaded_files);

  if (!isUuid(sessionId)) {
    return errorResponse("session_id inválido", 400, "invalid_session_id");
  }
  if (!isUuid(stagingId)) {
    return errorResponse("staging_id inválido", 400, "invalid_staging_id");
  }

  const uploadedValidation = validateUploadedFiles(uploadedFiles);
  if (uploadedValidation) {
    return errorResponse(uploadedValidation, 400, "invalid_uploaded_files");
  }

  let receiptSecret: string;
  try {
    receiptSecret = requireEnv("APPS_SCRIPT_SHARED_SECRET");
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "APPS_SCRIPT_SHARED_SECRET faltante",
      500,
      "missing_apps_script_secret",
    );
  }

  const receiptValidation = await validateReceipts(uploadedFiles, sessionId, stagingId, receiptSecret);
  if (receiptValidation) {
    return errorResponse(receiptValidation, 400, "invalid_receipt");
  }

  const admin = getAdminClient();

  const { data: sessionRow, error: sessionError } = await admin
    .from("sesiones")
    .select("session_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return errorResponse("No se pudo validar la sesión", 500, "session_query_failed", sessionError.message);
  }
  if (!sessionRow) {
    return errorResponse("session_id no encontrado", 404, "session_not_found");
  }

  const { data: stagingRow, error: stagingError } = await admin
    .from("contribuciones_upload_staging")
    .select("staging_id, session_id, status, file_count, files, expires_at")
    .eq("staging_id", stagingId)
    .maybeSingle();

  if (stagingError) {
    return errorResponse("No se pudo consultar staging", 500, "staging_query_failed", stagingError.message);
  }
  if (!stagingRow) {
    return errorResponse("staging_id no encontrado", 404, "staging_not_found");
  }
  if (stagingRow.session_id !== sessionId) {
    return errorResponse("staging no pertenece a la sesión", 403, "staging_forbidden");
  }
  if (["finalized", "cancelled", "expired"].includes(stagingRow.status)) {
    return errorResponse("staging no admite finalización en su estado actual", 409, "staging_invalid_status");
  }
  if (new Date(stagingRow.expires_at).getTime() <= Date.now()) {
    return errorResponse("staging expirado", 409, "staging_expired");
  }

  const existingFiles = normalizeStagedFiles(stagingRow.files);
  const byDriveId = new Map<string, StagedFile>();

  for (const file of existingFiles) {
    byDriveId.set(file.drive_file_id, file);
  }

  for (const file of uploadedFiles) {
    byDriveId.set(file.drive_file_id, {
      drive_file_id: file.drive_file_id,
      name: file.name,
      mime: file.mime,
      size: file.size,
      receipt: file.receipt,
      received_at: new Date().toISOString(),
    });
  }

  const mergedFiles = Array.from(byDriveId.values());
  if (mergedFiles.length < 1) {
    return errorResponse("No hay archivos válidos tras la finalización", 400, "empty_files_after_finalize");
  }
  if (mergedFiles.length > UPLOAD_LIMITS.maxFiles) {
    return errorResponse(`Se supera el máximo de ${UPLOAD_LIMITS.maxFiles} archivos`, 400, "max_files_exceeded");
  }

  const totalBytes = computeTotalBytes(mergedFiles);
  for (const file of mergedFiles) {
    if (!UPLOAD_LIMITS.allowedMime.includes(file.mime)) {
      return errorResponse(`MIME no permitido: ${file.mime}`, 400, "invalid_mime");
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > UPLOAD_LIMITS.maxFileBytes) {
      return errorResponse(`Tamaño inválido para ${file.name}`, 400, "invalid_file_size");
    }
  }

  const refreshExpiry = new Date(Date.now() + STAGING_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await admin
    .from("contribuciones_upload_staging")
    .update({
      status: "uploaded",
      files: mergedFiles,
      file_count: mergedFiles.length,
      total_bytes: totalBytes,
      expires_at: refreshExpiry,
      last_error: null,
    })
    .eq("staging_id", stagingId);

  if (updateError) {
    return errorResponse("No se pudo actualizar staging", 500, "staging_update_failed", updateError.message);
  }

  return jsonResponse({
    ok: true,
    staging_id: stagingId,
    file_count: mergedFiles.length,
    total_bytes: totalBytes,
    files: mergedFiles.map((file) => ({
      drive_file_id: file.drive_file_id,
      name: file.name,
      mime: file.mime,
      size: file.size,
    })),
    ready_for_submit: true,
  });
});
