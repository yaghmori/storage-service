function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '[::1]'
  );
}

/** Compose DNS names are a single label ("minio") — browsers cannot resolve them. */
function isDockerServiceHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized || isLoopbackHost(normalized)) return false;
  return !normalized.includes('.');
}

/**
 * True when a browser (not Docker DNS) can reach this S3-compatible API
 * for presigned GET/PUT. Empty endpoint = AWS default (public API).
 */
export function isBrowserReachableS3Endpoint(
  rawEndpoint: string | undefined,
): boolean {
  const trimmed = rawEndpoint?.trim() || '';
  if (!trimmed) return true;

  try {
    const url = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    if (isLoopbackHost(url.hostname) || isDockerServiceHost(url.hostname)) {
      return false;
    }
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** True when `raw` is the app CDN (FILES_PUBLIC_BASE_URL), not a store S3 API. */
export function isFilesPublicBaseHost(raw: string | undefined): boolean {
  const filesBase = process.env.FILES_PUBLIC_BASE_URL?.trim();
  const trimmed = raw?.trim() || '';
  if (!filesBase || !trimmed) return false;
  try {
    const browser = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    const files = new URL(filesBase);
    return browser.hostname.toLowerCase() === files.hostname.toLowerCase();
  } catch {
    return false;
  }
}
