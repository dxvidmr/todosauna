import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { deleteFromAppsScript } from "../_shared/apps-script.ts";
import { corsHeaders, errorResponse, isOptions, jsonResponse } from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import {
  FINALIZED_RETENTION_DAYS,
  STALE_RETENTION_HOURS,
  requireEnv,
} from "../_shared/upload-config.ts";

type StagingRow = {
  staging_id: string;
  status: string;
  files: unknown;
  cleanup_attempts: number;
};

function extractDriveFileIds(filesRaw: unknown): string[] {
  if (!Array.isArray(filesRaw)) return [];
  return filesRaw
    .map((raw) => {
      if (!raw || typeof raw !== "object") return "";
      return String((raw as Record<string, unknown>).drive_file_id || "").trim();
    })
    .filter(Boolean);
}

function assertCleanupAuth(req: Request): { ok: true } | { ok: false; response: Response } {
  const authHeader = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) {
    return { ok: false, response: errorResponse("Authorization requerido", 401, "missing_authorization") };
  }

  const token = authHeader.slice(prefix.length).trim();
  let expectedSecret = "";
  try {
    expectedSecret = requireEnv("CLEANUP_JOB_SECRET");
  } catch (error) {
    return {
      ok: false,
      response: errorResponse(
        error instanceof Error ? error.message : "CLEANUP_JOB_SECRET faltante",
        500,
        "missing_cleanup_secret",
      ),
    };
  }

  if (!token || token !== expectedSecret) {
    return { ok: false, response: errorResponse("No autorizado", 401, "invalid_authorization") };
  }

  return { ok: true };
}

async function deleteRowsByStatusAndAge(
  status: string,
  cutoffIso: string,
): Promise<number> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("contribuciones_upload_staging")
    .delete()
    .eq("status", status)
    .lt("updated_at", cutoffIso)
    .select("staging_id");

  if (error) {
    throw new Error(`No se pudo purgar status=${status}: ${error.message}`);
  }

  return Array.isArray(data) ? data.length : 0;
}

serve(async (req: Request): Promise<Response> => {
  if (isOptions(req)) {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Método no permitido", 405, "method_not_allowed");
  }

  const authCheck = assertCleanupAuth(req);
  if (!authCheck.ok) return authCheck.response;

  const admin = getAdminClient();
  const staleCutoffIso = new Date(
    Date.now() - STALE_RETENTION_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const finalizedCutoffIso = new Date(
    Date.now() - FINALIZED_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const metrics = {
    scanned: 0,
    expired: 0,
    cleanup_failed: 0,
    deleted_files: 0,
    deleted_rows: 0,
    failed: 0,
  };

  const staleStatuses = ["issued", "uploading", "uploaded", "cancelled"];
  const { data: staleRows, error: staleError } = await admin
    .from("contribuciones_upload_staging")
    .select("staging_id, status, files, cleanup_attempts")
    .in("status", staleStatuses)
    .lt("updated_at", staleCutoffIso)
    .limit(500);

  if (staleError) {
    return errorResponse(
      "No se pudo cargar staging stale",
      500,
      "stale_query_failed",
      staleError.message,
    );
  }

  const rows = Array.isArray(staleRows) ? (staleRows as StagingRow[]) : [];
  metrics.scanned = rows.length;

  for (const row of rows) {
    const fileIds = extractDriveFileIds(row.files);
    const deleteResult = await deleteFromAppsScript(fileIds, row.staging_id);
    metrics.deleted_files += deleteResult.deleted.length;

    const nextStatus = deleteResult.ok ? "expired" : "cleanup_failed";
    const nextError = deleteResult.ok ? null : (deleteResult.error || "Error borrando en Apps Script");
    if (deleteResult.ok) {
      metrics.expired += 1;
    } else {
      metrics.cleanup_failed += 1;
      metrics.failed += 1;
    }

    const { error: updateError } = await admin
      .from("contribuciones_upload_staging")
      .update({
        status: nextStatus,
        cleanup_attempts: Number(row.cleanup_attempts || 0) + 1,
        last_error: nextError,
      })
      .eq("staging_id", row.staging_id);

    if (updateError) {
      metrics.failed += 1;
    }
  }

  try {
    metrics.deleted_rows += await deleteRowsByStatusAndAge("finalized", finalizedCutoffIso);
    metrics.deleted_rows += await deleteRowsByStatusAndAge("expired", staleCutoffIso);
    metrics.deleted_rows += await deleteRowsByStatusAndAge("cancelled", staleCutoffIso);
    metrics.deleted_rows += await deleteRowsByStatusAndAge("cleanup_failed", finalizedCutoffIso);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Error purgando filas",
      500,
      "purge_failed",
    );
  }

  return jsonResponse({
    ok: true,
    metrics,
    cutoffs: {
      stale_cutoff: staleCutoffIso,
      finalized_cutoff: finalizedCutoffIso,
    },
  });
});
