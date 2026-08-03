/**
 * PostgreSQL jsonb rejects U+0000 in strings. EXIF/IPTC often embeds null
 * bytes (e.g. ApplicationRecordVersion "\0\0"). Also normalize Dates/Buffers.
 */
export function sanitizeForJsonb(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 20) return null;

  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '');
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.toString('hex');
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('hex');
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForJsonb(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (typeof nested === 'function' || typeof nested === 'symbol') continue;
      const cleanKey = key.replace(/\u0000/g, '');
      if (!cleanKey) continue;
      out[cleanKey] = sanitizeForJsonb(nested, depth + 1);
    }
    return out;
  }
  return String(value);
}
