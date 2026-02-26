function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function getBoundary(contentType: string): string | null {
  const match = /boundary=([^;]+)/i.exec(contentType || '');
  if (!match || !match[1]) return null;
  return stripQuotes(match[1]);
}

export function extractMultipartFields(contentType: string, rawBody: Buffer): Record<string, string> {
  const boundary = getBoundary(contentType);
  if (!boundary) return {};

  const delimiter = `--${boundary}`;
  const body = rawBody.toString('latin1');
  const parts = body.split(delimiter);
  const fields: Record<string, string> = {};

  for (const partRaw of parts) {
    let part = partRaw;
    if (!part || part === '--' || part === '--\r\n') continue;
    if (part.startsWith('\r\n')) part = part.slice(2);
    if (part.endsWith('\r\n')) part = part.slice(0, -2);
    if (part.endsWith('--')) part = part.slice(0, -2);

    const splitIdx = part.indexOf('\r\n\r\n');
    if (splitIdx < 0) continue;

    const headers = part.slice(0, splitIdx);
    let value = part.slice(splitIdx + 4);
    if (value.endsWith('\r\n')) value = value.slice(0, -2);

    const nameMatch = /name="([^"]+)"/i.exec(headers);
    if (!nameMatch || !nameMatch[1]) continue;

    const hasFilename = /filename="([^"]*)"/i.test(headers);
    if (hasFilename) continue;

    fields[nameMatch[1]] = value;
  }

  return fields;
}
