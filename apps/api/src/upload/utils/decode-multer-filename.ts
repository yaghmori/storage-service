/**
 * Multer/busboy historically decode multipart Content-Disposition filenames as
 * latin1. UTF-8 names (e.g. Persian) then appear mojibaked in `originalname`.
 * Re-interpret as UTF-8 when that yields valid non-ASCII text.
 */
export function decodeMulterFilename(name: string): string {
  if (!name) return name;

  // Already contains Arabic/Persian script — leave alone (already UTF-8).
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(name)) {
    return name;
  }

  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (decoded.includes('\uFFFD') || decoded === name) return name;
    // Accept only when decode introduces Unicode beyond latin1 control/printable.
    if (/[^\u0000-\u00FF]/.test(decoded)) {
      return decoded;
    }
  } catch {
    // keep original
  }

  return name;
}
