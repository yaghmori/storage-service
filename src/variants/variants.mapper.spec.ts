import { toVariantResponse } from './variants.mapper';
import type { fileVariants } from '../database/drizzle/schema';

type VariantRow = typeof fileVariants.$inferSelect;

describe('toVariantResponse', () => {
  const mockVariantRow: VariantRow = {
    id: 'variant-123',
    fileId: 'file-123',
    variantType: 'thumbnail',
    variantKey: 'files/thumbnails/test.jpg',
    storageProviderId: 'provider-123',
    size: BigInt(512),
    width: 100,
    height: 100,
    quality: 80,
    format: 'jpeg',
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };

  it('should map a valid variant row to VariantResponse', () => {
    const result = toVariantResponse(mockVariantRow);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(mockVariantRow.id);
    expect(result?.fileId).toBe(mockVariantRow.fileId);
    expect(result?.name).toBe(mockVariantRow.variantType);
    expect(result?.key).toBe(mockVariantRow.variantKey);
    expect(result?.mimeType).toBe('image/jpeg');
    expect(result?.size).toBe(512);
    expect(result?.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should return null for null input', () => {
    const result = toVariantResponse(null);
    expect(result).toBeNull();
  });

  it('should map format to MIME type correctly', () => {
    expect(toVariantResponse({ ...mockVariantRow, format: 'png' })?.mimeType).toBe('image/png');
    expect(toVariantResponse({ ...mockVariantRow, format: 'webp' })?.mimeType).toBe('image/webp');
    expect(toVariantResponse({ ...mockVariantRow, format: 'jpg' })?.mimeType).toBe('image/jpeg');
    expect(toVariantResponse({ ...mockVariantRow, format: 'mp4' })?.mimeType).toBe('video/mp4');
  });

  it('should use default MIME type for unknown formats', () => {
    const result = toVariantResponse({ ...mockVariantRow, format: 'unknown-format' });
    expect(result?.mimeType).toBe('application/octet-stream');
  });

  it('should use default MIME type for null format', () => {
    const result = toVariantResponse({ ...mockVariantRow, format: null });
    expect(result?.mimeType).toBe('application/octet-stream');
  });

  it('should convert BigInt size to number', () => {
    const largeVariant = {
      ...mockVariantRow,
      size: BigInt(1024 * 1024),
    };
    const result = toVariantResponse(largeVariant);
    expect(result?.size).toBe(1048576);
    expect(typeof result?.size).toBe('number');
  });

  it('should use createdAt for updatedAt when updatedAt is not available', () => {
    const result = toVariantResponse(mockVariantRow);
    expect(result?.updatedAt).toBe(result?.createdAt);
  });
});

