import { optionalEnv, requireEnv } from "./upload-config.ts";

export type AppsDeleteResult = {
  ok: boolean;
  deleted: string[];
  not_found: string[];
  error?: string;
  raw?: unknown;
};

export async function deleteFromAppsScript(
  fileIds: string[],
  stagingId: string,
): Promise<AppsDeleteResult> {
  const normalizedFileIds = (fileIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!normalizedFileIds.length) {
    return { ok: true, deleted: [], not_found: [] };
  }

  const appsScriptUrl = optionalEnv("APPS_SCRIPT_URL");
  const sharedSecret = optionalEnv("APPS_SCRIPT_SHARED_SECRET");
  if (!appsScriptUrl || !sharedSecret) {
    return {
      ok: false,
      deleted: [],
      not_found: [],
      error: "APPS_SCRIPT_URL o APPS_SCRIPT_SHARED_SECRET no configurado",
    };
  }

  let response: Response;
  try {
    response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-upload-shared-secret": sharedSecret,
      },
      body: JSON.stringify({
        action: "delete",
        staging_id: stagingId,
        file_ids: normalizedFileIds,
        shared_secret: sharedSecret,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      deleted: [],
      not_found: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      deleted: [],
      not_found: [],
      error: `Apps Script respondió ${response.status}`,
      raw: payload,
    };
  }

  const parsed = (payload && typeof payload === "object"
    ? payload
    : {}) as Record<string, unknown>;

  if (parsed.ok === false) {
    const rawError = parsed.error;
    const message = typeof rawError === "string"
      ? rawError
      : (rawError && typeof rawError === "object" && "message" in rawError)
      ? String((rawError as { message?: unknown }).message || "Apps Script devolvio error")
      : "Apps Script devolvio error";

    return {
      ok: false,
      deleted: [],
      not_found: [],
      error: message,
      raw: payload,
    };
  }

  const deleted = Array.isArray(parsed.deleted)
    ? parsed.deleted.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const notFound = Array.isArray(parsed.not_found)
    ? parsed.not_found.map((id) => String(id || "").trim()).filter(Boolean)
    : [];

  return {
    ok: true,
    deleted,
    not_found: notFound,
    raw: payload,
  };
}

export function requireAppsScriptUrl(): string {
  return requireEnv("APPS_SCRIPT_URL");
}
