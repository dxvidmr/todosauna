import { UPLOAD_LIMITS } from "./upload-config.ts";

export type ManifestFile = {
  name: string;
  mime: string;
  size: number;
};

export type UploadedFile = {
  drive_file_id: string;
  name: string;
  mime: string;
  size: number;
  receipt: string;
};

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSize(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
}

export function normalizeManifest(input: unknown): ManifestFile[] {
  if (!Array.isArray(input)) return [];
  return input.map((raw) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      name: normalizeText(row.name),
      mime: normalizeText(row.mime).toLowerCase(),
      size: normalizeSize(row.size),
    };
  });
}

export function normalizeUploadedFiles(input: unknown): UploadedFile[] {
  if (!Array.isArray(input)) return [];
  return input.map((raw) => {
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      drive_file_id: normalizeText(row.drive_file_id),
      name: normalizeText(row.name),
      mime: normalizeText(row.mime).toLowerCase(),
      size: normalizeSize(row.size),
      receipt: normalizeText(row.receipt),
    };
  });
}

export function validateManifest(manifest: ManifestFile[]): string | null {
  if (!manifest.length) return "Debes indicar al menos un archivo en file_manifest";
  if (manifest.length > UPLOAD_LIMITS.maxFiles) {
    return `No puedes subir más de ${UPLOAD_LIMITS.maxFiles} archivos por envío`;
  }

  for (const file of manifest) {
    if (!file.name) return "Cada archivo debe incluir name";
    if (!file.mime) return "Cada archivo debe incluir mime";
    if (!UPLOAD_LIMITS.allowedMime.includes(file.mime)) {
      return `MIME no permitido: ${file.mime}`;
    }
    if (file.size <= 0 || file.size > UPLOAD_LIMITS.maxFileBytes) {
      return `Tamaño inválido para ${file.name}`;
    }
  }

  return null;
}

export function validateUploadedFiles(uploaded: UploadedFile[]): string | null {
  if (!uploaded.length) return "uploaded_files debe incluir al menos un archivo";
  if (uploaded.length > UPLOAD_LIMITS.maxFiles) {
    return `No puedes finalizar más de ${UPLOAD_LIMITS.maxFiles} archivos por ronda`;
  }

  for (const file of uploaded) {
    if (!file.drive_file_id) return "Cada archivo finalizado debe incluir drive_file_id";
    if (!file.name) return "Cada archivo finalizado debe incluir name";
    if (!file.mime) return "Cada archivo finalizado debe incluir mime";
    if (!UPLOAD_LIMITS.allowedMime.includes(file.mime)) {
      return `MIME no permitido en uploaded_files: ${file.mime}`;
    }
    if (file.size <= 0 || file.size > UPLOAD_LIMITS.maxFileBytes) {
      return `Tamaño inválido en uploaded_files para ${file.name}`;
    }
    if (!file.receipt) return `Falta receipt firmado para ${file.name}`;
  }

  return null;
}
