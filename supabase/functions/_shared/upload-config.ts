export const UPLOAD_LIMITS = {
  maxFiles: 10,
  maxFileBytes: 20 * 1024 * 1024,
  allowedMime: [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/tiff",
  ],
} as const;

export const UPLOAD_TOKEN_TTL_SECONDS = 10 * 60;
export const STAGING_TTL_HOURS = 24;
export const STALE_RETENTION_HOURS = 24;
export const FINALIZED_RETENTION_DAYS = 7;

export function requireEnv(name: string): string {
  const value = (Deno.env.get(name) || "").trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | null {
  const value = (Deno.env.get(name) || "").trim();
  return value || null;
}
