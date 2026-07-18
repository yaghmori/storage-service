/**
 * Convert BigInt (and nested BigInts) into JSON-safe numbers/strings.
 * Drizzle `bigint` columns break Express `res.json()` otherwise.
 */
export function toJsonSafe<T>(value: T): T {
  return sanitize(value) as T;
}

function sanitize(value: unknown): unknown {
  if (typeof value === 'bigint') {
    // Prefer number when safe; otherwise string (file sizes can exceed 2^53-1).
    return value <= BigInt(Number.MAX_SAFE_INTEGER) &&
      value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }

  if (value instanceof Date || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitize(nested);
    }
    return out;
  }

  return value;
}
