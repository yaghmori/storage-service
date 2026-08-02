/**
 * Platform hard ceiling for multipart uploads (DoS protection).
 * Org limits may only tighten further inside UploadService.
 */
export function platformMulterFileLimits(): { fileSize: number } {
  const parsed = parseInt(process.env.MAX_FILE_SIZE || '104857600', 10);
  return {
    fileSize: Number.isFinite(parsed) && parsed > 0 ? parsed : 104857600,
  };
}
