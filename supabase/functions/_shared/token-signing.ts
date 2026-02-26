function toBase64Url(input: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < input.length; i += 1) {
    binary += String.fromCharCode(input[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}

async function signBytes(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(signature));
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch (_error) {
    return null;
  }
}

export async function createSignedToken(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const payloadEncoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signBytes(payloadEncoded, secret);
  return `${payloadEncoded}.${signature}`;
}

export async function verifySignedToken<T = Record<string, unknown>>(
  token: string,
  secret: string,
): Promise<{ valid: true; payload: T } | { valid: false; reason: string }> {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "Formato de token inválido" };
  }

  const [payloadEncoded, signature] = parts;
  const expectedSignature = await signBytes(payloadEncoded, secret);
  if (signature !== expectedSignature) {
    return { valid: false, reason: "Firma inválida" };
  }

  const payloadRaw = new TextDecoder().decode(fromBase64Url(payloadEncoded));
  const payload = safeJsonParse<T>(payloadRaw);
  if (!payload) {
    return { valid: false, reason: "Payload inválido" };
  }

  const payloadAsRecord = payload as Record<string, unknown>;
  const exp = Number(payloadAsRecord.exp || 0);
  if (Number.isFinite(exp) && exp > 0 && exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, reason: "Token expirado" };
  }

  return { valid: true, payload };
}
