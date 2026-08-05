/**
 * RFC 5987 Content-Disposition so browsers preserve UTF-8 download names
 * (Persian/Arabic) while keeping an ASCII `filename=` fallback.
 */
export function buildContentDisposition(
  filename: string,
  asDownload: boolean,
): string {
  const type = asDownload ? 'attachment' : 'inline';
  const cleaned = (filename || 'file').replace(/[\r\n"]/g, '_');
  const asciiFallback =
    cleaned.replace(/[^\x20-\x7E]/g, '_').replace(/\\/g, '_') || 'file';
  const encoded = encodeURIComponent(cleaned)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
