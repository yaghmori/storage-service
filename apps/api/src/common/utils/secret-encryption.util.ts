import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(secret: string): Buffer {
  // Deterministic key derivation from platform secret (salt is fixed app namespace).
  return scryptSync(secret, 'storage-service-processor-creds-v1', KEY_LENGTH);
}

/**
 * Encrypt a secret string for processor_backends.config.
 * Format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 */
export function encryptSecret(plaintext: string, encryptionKey: string): string {
  if (!encryptionKey?.trim()) {
    throw new Error('PROCESSOR_CREDENTIALS_ENCRYPTION_KEY is required to store secrets');
  }
  const key = deriveKey(encryptionKey.trim());
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string, encryptionKey: string): string {
  if (!encryptionKey?.trim()) {
    throw new Error('PROCESSOR_CREDENTIALS_ENCRYPTION_KEY is required to read secrets');
  }
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted secret format');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = deriveKey(encryptionKey.trim());
  const iv = Buffer.from(ivB64!, 'base64url');
  const tag = Buffer.from(tagB64!, 'base64url');
  const data = Buffer.from(dataB64!, 'base64url');
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted secret payload');
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function last4(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.slice(-4);
}

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('v1:') && value.split(':').length === 4;
}
