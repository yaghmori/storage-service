import { createHmac, timingSafeEqual } from 'crypto';

const DOWNLOAD_PATH =
  /^\/(?:v\d+\/)?files\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/download\/?$/i;

export type FileDownloadHmacPayload = {
  fileId: string;
  exp: number;
  variant?: string;
};

export function filesSigningSecret(): string {
  const secret =
    process.env.FILES_SIGNING_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '';
  return secret;
}

export function assertFilesSigningSecret(): string {
  const secret = filesSigningSecret();
  if (!secret) {
    throw new Error(
      'FILES_SIGNING_SECRET (or JWT_SECRET) is required to sign download URLs',
    );
  }
  if (
    process.env.NODE_ENV === 'production' &&
    secret.length < 32
  ) {
    throw new Error(
      'FILES_SIGNING_SECRET must be at least 32 characters in production',
    );
  }
  return secret;
}

function payloadString(input: FileDownloadHmacPayload): string {
  return `${input.fileId}\n${input.exp}\n${input.variant ?? ''}`;
}

export function signFileDownload(
  input: FileDownloadHmacPayload,
  secret: string,
): string {
  return createHmac('sha256', secret).update(payloadString(input)).digest(
    'base64url',
  );
}

export function verifyFileDownloadHmac(
  input: FileDownloadHmacPayload,
  sig: string,
  secret: string,
): boolean {
  if (!sig?.trim() || !secret) return false;
  if (!Number.isFinite(input.exp) || input.exp * 1000 < Date.now()) {
    return false;
  }
  const expected = signFileDownload(input, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseFileDownloadPath(
  path: string,
): string | undefined {
  const match = path.split('?')[0]?.match(DOWNLOAD_PATH);
  return match?.[1];
}

export function remainingTtlSeconds(exp: number, fallback = 3600): number {
  if (!Number.isFinite(exp) || exp <= 0) return fallback;
  const remaining = exp - Math.floor(Date.now() / 1000);
  return remaining > 0 ? remaining : 1;
}
