import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { deleteFromAppsScript } from "../_shared/apps-script.ts";
import { corsHeaders, errorResponse, isOptions, jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

type SessionRow = {
  session_id: string;
};

type StagingRow = {
  staging_id: string;
  session_id: string;
  status: string;
  files: unknown;
  cleanup_attempts: number;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractDriveFileIds(filesRaw: unknown): string[] {
  if (!Array.isArray(filesRaw)) return [];
  return filesRaw
    .map((raw) => {
      if (!raw || typeof raw !== "object") return "";
      return String((raw as Record<string, unknown>).drive_file_id || "").trim();
    })
    .filter(Boolean);
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

  if (!isUuid(sessionId)) {
    return errorResponse("session_id inválido", 400, "invalid_session_id");
  }
  if (!isUuid(stagingId)) {
    return errorResponse("staging_id inválido", 400, "invalid_staging_id");
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
    .select("staging_id, session_id, status, files, cleanup_attempts")
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
  if (stagingRow.status === "finalized") {
    return errorResponse("No se puede cancelar un staging finalizado", 409, "staging_already_finalized");
  }

  const fileIds = extractDriveFileIds(stagingRow.files);
  const deleteResult = await deleteFromAppsScript(fileIds, stagingId);
  const lastError = deleteResult.ok ? null : (deleteResult.error || "Error eliminando archivos en Apps Script");

  const { error: updateError } = await admin
    .from("contribuciones_upload_staging")
    .update({
      status: "cancelled",
      cleanup_attempts: Number(stagingRow.cleanup_attempts || 0) + 1,
      last_error: lastError,
    })
    .eq("staging_id", stagingId);

  if (updateError) {
    return errorResponse("No se pudo actualizar staging tras cancelación", 500, "staging_update_failed", updateError.message);
  }

  return jsonResponse({
    ok: true,
    staging_id: stagingId,
    status: "cancelled",
    delete_summary: {
      attempted: fileIds.length,
      deleted: deleteResult.deleted.length,
      not_found: deleteResult.not_found.length,
      success: deleteResult.ok,
      error: deleteResult.error || null,
    },
  });
});
