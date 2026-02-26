import { getClientIp } from "./http.ts";

type RecaptchaResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export async function verifyRecaptcha(
  req: Request,
  token: string,
  secret: string,
): Promise<{ ok: true } | { ok: false; reason: string; details?: unknown }> {
  const trimmedToken = String(token || "").trim();
  if (!trimmedToken) {
    return { ok: false, reason: "recaptcha_token es obligatorio" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", trimmedToken);
  body.set("remoteip", getClientIp(req));

  let response: Response;
  try {
    response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (error) {
    return {
      ok: false,
      reason: "No se pudo verificar reCAPTCHA",
      details: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "Google reCAPTCHA devolvió un error HTTP",
      details: { status: response.status },
    };
  }

  const payload = (await response.json()) as RecaptchaResponse;
  if (!payload.success) {
    return {
      ok: false,
      reason: "reCAPTCHA inválido",
      details: payload["error-codes"] || null,
    };
  }

  return { ok: true };
}
