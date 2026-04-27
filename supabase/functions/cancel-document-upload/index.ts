import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { deleteFromAppsScript } from "../_shared/apps-script.ts";
import { corsHeaders, errorResponse, isOptions, jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";

type StagingRow = {
  staging_id: string;
  session_id: string;
  status: string;
  files: unknown;
  cleanup_attempts: number;
};

type StagedFile = {
  drive_file_id: string;
  name: string;
  mime: string;
  size: number;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeRequestedFileIds(fileIdsRaw: unknown): string[] | null {
  if (fileIdsRaw === undefined || fileIdsRaw === null) return null;
  if (!Array.isArray(fileIdsRaw)) {
    throw new Error("file_ids debe ser un array de strings");
  }

  const unique = new Set<string>();
  for (const raw of fileIdsRaw) {
    const id = String(raw || "").trim();
    if (!id) {
      throw new Error("file_ids contiene IDs vacíos");
    }
    unique.add(id);
  }

  const values = Array.from(unique);
  if (!values.length) {
    throw new Error("file_ids no puede estar vacío");
  }
  return values;
}

function normalizeStagedFiles(filesRaw: unknown): StagedFile[] {
  if (!Array.isArray(filesRaw)) return [];
  return filesRaw
    .map((raw) => {
      const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        drive_file_id: String(row.drive_file_id || "").trim(),
        name: String(row.name || "").trim(),
        mime: String(row.mime || "").trim().toLowerCase(),
        size: Number(row.size || 0),
      };
    })
    .filter((row) => !!row.drive_file_id);
}

function computeTotalBytes(files: StagedFile[]): number {
  return files.reduce((sum, file) => {
    const size = Number(file.size || 0);
    return sum + (Number.isFinite(size) && size > 0 ? size : 0);
  }, 0);
}

function mapPublicFiles(files: StagedFile[]): Array<{ drive_file_id: string; name: string; mime: string; size: number }> {
  return files.map((file) => ({
    drive_file_id: file.drive_file_id,
    name: file.name,
    mime: file.mime,
    size: file.size,
  }));
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

  let requestedFileIds: string[] | null;
  try {
    requestedFileIds = normalizeRequestedFileIds(body.file_ids);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "file_ids inválido",
      400,
      "invalid_file_ids",
    );
  }

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
  const typedStagingRow = stagingRow as StagingRow;
  if (typedStagingRow.session_id !== sessionId) {
    return errorResponse("staging no pertenece a la sesión", 403, "staging_forbidden");
  }
  if (typedStagingRow.status === "finalized") {
    return errorResponse("No se puede cancelar un staging finalizado", 409, "staging_already_finalized");
  }

  const stagedFiles = normalizeStagedFiles(typedStagingRow.files);

  if (requestedFileIds) {
    const stagedFileIdSet = new Set(stagedFiles.map((file) => file.drive_file_id));
    const unknownIds = requestedFileIds.filter((id) => !stagedFileIdSet.has(id));
    if (unknownIds.length) {
      return errorResponse(
        "Algunos file_ids no pertenecen al staging indicado",
        400,
        "file_ids_not_in_staging",
        unknownIds.join(", "),
      );
    }

    const deleteResult = await deleteFromAppsScript(requestedFileIds, stagingId);
    if (!deleteResult.ok) {
      await admin
        .from("contribuciones_upload_staging")
        .update({
          cleanup_attempts: Number(typedStagingRow.cleanup_attempts || 0) + 1,
          last_error: deleteResult.error || "Error eliminando archivos en Apps Script",
        })
        .eq("staging_id", stagingId);

      return errorResponse(
        "No se pudieron eliminar los archivos solicitados",
        502,
        "apps_script_delete_failed",
        deleteResult.error || null,
      );
    }

    const removedIds = new Set<string>([...deleteResult.deleted, ...deleteResult.not_found]);
    const remainingFiles = stagedFiles.filter((file) => !removedIds.has(file.drive_file_id));
    const nextStatus = remainingFiles.length > 0 ? "uploaded" : "issued";
    const totalBytes = computeTotalBytes(remainingFiles);

    const { error: updatePartialError } = await admin
      .from("contribuciones_upload_staging")
      .update({
        status: nextStatus,
        files: remainingFiles,
        file_count: remainingFiles.length,
        total_bytes: totalBytes,
        last_error: null,
      })
      .eq("staging_id", stagingId);

    if (updatePartialError) {
      return errorResponse(
        "No se pudo actualizar staging tras borrado parcial",
        500,
        "staging_update_failed",
        updatePartialError.message,
      );
    }

    return jsonResponse({
      ok: true,
      staging_id: stagingId,
      status: nextStatus,
      file_count: remainingFiles.length,
      total_bytes: totalBytes,
      files: mapPublicFiles(remainingFiles),
      delete_summary: {
        attempted: requestedFileIds.length,
        deleted: deleteResult.deleted.length,
        not_found: deleteResult.not_found.length,
        success: true,
        error: null,
      },
    });
  }

  const fileIds = stagedFiles.map((file) => file.drive_file_id).filter(Boolean);
  const deleteResult = await deleteFromAppsScript(fileIds, stagingId);
  const lastError = deleteResult.ok ? null : (deleteResult.error || "Error eliminando archivos en Apps Script");

  const { error: updateError } = await admin
    .from("contribuciones_upload_staging")
    .update({
      status: "cancelled",
      cleanup_attempts: Number(typedStagingRow.cleanup_attempts || 0) + 1,
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
