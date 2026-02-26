export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-upload-shared-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(
  payload: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  code = "bad_request",
  details?: unknown,
): Response {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    status,
  );
}

export async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch (_error) {
    throw new Error("Body JSON inválido");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Body JSON debe ser un objeto");
  }

  return parsed as Record<string, unknown>;
}

export function getRequestHost(req: Request): string {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");

  const candidates = [origin, referer, forwardedHost, host].filter(Boolean) as string[];
  for (const item of candidates) {
    try {
      const normalized = item.startsWith("http")
        ? new URL(item).hostname
        : item.split(":")[0];
      if (normalized) return normalized.toLowerCase();
    } catch (_error) {
      // Ignore malformed values and continue.
    }
  }

  return "";
}

export function isLocalHostRequest(req: Request): boolean {
  const host = getRequestHost(req);
  if (!host) return false;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "0.0.0.0";
}

export function isOptions(req: Request): boolean {
  return req.method.toUpperCase() === "OPTIONS";
}
