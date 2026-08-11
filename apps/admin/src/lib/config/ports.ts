/**
 * Admin listen / upstream URL resolution from env.
 * Prefer full URLs; host+port fall back for flexibility.
 */

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function parsePort(raw: string | undefined, fallback: number): number {
  const value = parseInt(raw || String(fallback), 10);
  if (Number.isNaN(value) || value <= 0 || value > 65535) {
    return fallback;
  }
  return value;
}

/** Next.js admin HTTP port (`PORT` or `ADMIN_PORT`). Default 6200. */
export function resolveAdminPort(): number {
  return parsePort(process.env.PORT || process.env.ADMIN_PORT, 6200);
}

/** Node inspector for admin (`DEBUG_PORT` / `ADMIN_DEBUG_PORT`). Default 6201. */
export function resolveAdminDebugPort(): number {
  return parsePort(
    process.env.DEBUG_PORT || process.env.ADMIN_DEBUG_PORT,
    6201,
  );
}

/**
 * Nest storage-service HTTP origin used by BFF routes (no `/api` prefix).
 * Priority: STORAGE_API_URL → STORAGE_API_HOST + STORAGE_API_PORT → localhost:6100
 */
export function resolveStorageApiUrl(): string {
  const explicit = process.env.STORAGE_API_URL?.trim();
  if (explicit) {
    return trimSlash(explicit).replace(/\/api$/i, "");
  }

  const host =
    process.env.STORAGE_API_HOST?.trim() ||
    process.env.STORAGE_SERVICE_HOST?.trim() ||
    "localhost";
  const port = parsePort(
    process.env.STORAGE_API_PORT || process.env.STORAGE_SERVICE_PORT,
    6100,
  );
  const protocol = process.env.STORAGE_API_PROTOCOL?.trim() || "http";
  return `${protocol}://${host}:${port}`;
}

/** Public browser origin for the admin app. */
export function resolveAdminAppUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.ADMIN_URL?.trim();
  if (explicit) return trimSlash(explicit);
  return `http://localhost:${resolveAdminPort()}`;
}
