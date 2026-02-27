import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { normalizeManifest, validateManifest } from "../_shared/file-validation.ts";
import { corsHeaders, errorResponse, isLocalHostRequest, isOptions, jsonResponse, parseJsonBody } from "../_shared/http.ts";
import { verifyRecaptcha } from "../_shared/recaptcha.ts";
import { getAdminClient } from "../_shared/supabase-admin.ts";
import { createSignedToken } from "../_shared/token-signing.ts";
import { STAGING_TTL_HOURS, UPLOAD_LIMITS, UPLOAD_TOKEN_TTL_SECONDS, requireEnv } from "../_shared/upload-config.ts";

type SessionRow = {
  session_id: string;
  collaborator_id: string | null;
};

type StagingRow = {
  staging_id: string;
  session_id: string;
  collaborator_id: string | null;
  status: string;
  expires_at: string;
  file_count: number;
};

const REUSABLE_STATUSES = new Set(["issued", "uploading", "uploaded"]);

function isLocalRequest(req: Request): boolean {
  if (isLocalHostRequest(req)) return true;
  try {
    const hostname = new URL(req.url).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch (_error) {
    return false;
  }
}

function shouldBypassRecaptcha(req: Request): boolean {
  if (isLocalRequest(req)) {
    console.info("[issue-upload-token] reCAPTCHA bypass enabled for localhost request");
    return true;
  }

  const bypassRaw = (Deno.env.get("UPLOAD_DEV_BYPASS_RECAPTCHA") || "").trim().toLowerCase();
  const bypassEnabled = bypassRaw === "true" || bypassRaw === "1" || bypassRaw === "yes";
  const ciEnabled = (Deno.env.get("CI") || "").trim().toLowerCase() === "true";
  const bypassFromEnv = bypassEnabled && ciEnabled;

  if (bypassFromEnv) {
    console.info("[issue-upload-token] reCAPTCHA bypass enabled for CI fallback");
  }

  return bypassFromEnv;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  const stagingIdInput = String(body.staging_id || "").trim() || null;
  const recaptchaToken = String(body.recaptcha_token || "").trim();
  const manifest = normalizeManifest(body.file_manifest);

  if (!isUuid(sessionId)) {
    return errorResponse("session_id inválido", 400, "invalid_session_id");
  }

  if (stagingIdInput && !isUuid(stagingIdInput)) {
    return errorResponse("staging_id inválido", 400, "invalid_staging_id");
  }

  const manifestValidation = validateManifest(manifest);
  if (manifestValidation) {
    return errorResponse(manifestValidation, 400, "invalid_file_manifest");
  }

  if (!shouldBypassRecaptcha(req)) {
    let recaptchaSecret: string;
    try {
      recaptchaSecret = requireEnv("RECAPTCHA_SECRET");
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "RECAPTCHA_SECRET no configurado",
        500,
        "missing_recaptcha_secret",
      );
    }

    const recaptchaCheck = await verifyRecaptcha(req, recaptchaToken, recaptchaSecret);
    if (!recaptchaCheck.ok) {
      return errorResponse(
        recaptchaCheck.reason,
        400,
        "recaptcha_invalid",
        recaptchaCheck.details,
      );
    }
  }

  let uploadTokenSecret: string;
  try {
    uploadTokenSecret = requireEnv("UPLOAD_TOKEN_SECRET");
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "UPLOAD_TOKEN_SECRET no configurado",
      500,
      "missing_upload_token_secret",
    );
  }

  const admin = getAdminClient();

  const { data: sessionRow, error: sessionError } = await admin
    .from("sesiones")
    .select("session_id, collaborator_id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return errorResponse("No se pudo validar la sesión", 500, "session_query_failed", sessionError.message);
  }
  if (!sessionRow) {
    return errorResponse("session_id no encontrado", 404, "session_not_found");
  }

  let staging: StagingRow | null = null;

  if (stagingIdInput) {
    const { data: existingStaging, error: stagingError } = await admin
      .from("contribuciones_upload_staging")
      .select("staging_id, session_id, collaborator_id, status, expires_at, file_count")
      .eq("staging_id", stagingIdInput)
      .maybeSingle();

    if (stagingError) {
      return errorResponse("No se pudo consultar staging", 500, "staging_query_failed", stagingError.message);
    }
    if (!existingStaging) {
      return errorResponse("staging_id no encontrado", 404, "staging_not_found");
    }
    if (existingStaging.session_id !== sessionId) {
      return errorResponse("staging no pertenece a la sesión", 403, "staging_forbidden");
    }
    if (new Date(existingStaging.expires_at).getTime() <= Date.now()) {
      return errorResponse("staging expirado", 409, "staging_expired");
    }
    if (!REUSABLE_STATUSES.has(existingStaging.status)) {
      return errorResponse("staging no reutilizable en este estado", 409, "staging_not_reusable");
    }

    staging = existingStaging;
  } else {
    const ttl = new Date(Date.now() + STAGING_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const jtiSeed = crypto.randomUUID();

    const { data: createdStaging, error: createError } = await admin
      .from("contribuciones_upload_staging")
      .insert({
        session_id: sessionId,
        collaborator_id: sessionRow.collaborator_id,
        status: "issued",
        expires_at: ttl,
        token_jti: jtiSeed,
        files: [],
        file_count: 0,
        total_bytes: 0,
        cleanup_attempts: 0,
      })
      .select("staging_id, session_id, collaborator_id, status, expires_at, file_count")
      .maybeSingle();

    if (createError || !createdStaging) {
      return errorResponse(
        "No se pudo crear staging",
        500,
        "staging_create_failed",
        createError?.message || null,
      );
    }
    staging = createdStaging;
  }

  if (!staging) {
    return errorResponse("No se pudo resolver staging", 500, "staging_resolution_failed");
  }

  const existingCount = Number(staging.file_count || 0);
  if (existingCount + manifest.length > UPLOAD_LIMITS.maxFiles) {
    return errorResponse(
      `Con los archivos ya subidos superarías el límite de ${UPLOAD_LIMITS.maxFiles}`,
      400,
      "max_files_exceeded",
    );
  }

  const tokenJti = crypto.randomUUID();
  const stagingExpiresAt = new Date(Date.now() + STAGING_TTL_HOURS * 60 * 60 * 1000);

  const { error: updateError } = await admin
    .from("contribuciones_upload_staging")
    .update({
      status: "uploading",
      token_jti: tokenJti,
      expires_at: stagingExpiresAt.toISOString(),
      collaborator_id: sessionRow.collaborator_id,
      last_error: null,
    })
    .eq("staging_id", staging.staging_id);

  if (updateError) {
    return errorResponse("No se pudo actualizar staging", 500, "staging_update_failed", updateError.message);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + UPLOAD_TOKEN_TTL_SECONDS;
  const uploadToken = await createSignedToken(
    {
      iss: "todos-a-una-upload",
      type: "upload",
      session_id: sessionId,
      staging_id: staging.staging_id,
      jti: tokenJti,
      iat: issuedAt,
      exp: expiresAt,
      max_files: UPLOAD_LIMITS.maxFiles,
      max_size_bytes: UPLOAD_LIMITS.maxFileBytes,
      allowed_mime: [...UPLOAD_LIMITS.allowedMime],
    },
    uploadTokenSecret,
  );

  return jsonResponse({
    ok: true,
    staging_id: staging.staging_id,
    upload_token: uploadToken,
    expires_at: new Date(expiresAt * 1000).toISOString(),
    limits: {
      max_files: UPLOAD_LIMITS.maxFiles,
      max_size_bytes: UPLOAD_LIMITS.maxFileBytes,
      allowed_mime: [...UPLOAD_LIMITS.allowedMime],
    },
  });
});
