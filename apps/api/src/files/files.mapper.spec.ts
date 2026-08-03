import { toFileResponse } from './files.mapper';
import type { files } from '../database/drizzle/schema';

type FileRow = typeof files.$inferSelect;

describe('toFileResponse', () => {
  const mockFileRow = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    orgId: 'org-123',
    storageProviderId: 'provider-123',
    storageKey: 'files/test.jpg',
    storageBucket: null,
    fileName: 'test.jpg',
    originalFileName: 'original-test.jpg',
    fileExtension: 'jpg',
    mimeType: 'image/jpeg',
    size: BigInt(1024),
    fileHash: 'abc123def456',
    perceptualHash: null,
    width: null,
    height: null,
    duration: null,
    alt: null,
    title: null,
    caption: null,
    description: null,
    folder: null,
    folderId: null,
    tags: null,
    referenceCount: 1,
    isOrphaned: false,
    orphanedAt: null,
    processingStatus: 'completed' as const,
    processingError: null,
    visibility: 'public' as const,
    downloadPassword: null,
    uploadedBy: 'user-123',
    externalId: null,
    externalProvider: null,
    cdnUrl: null,
    deletedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  } satisfies FileRow;

  it('should map a valid file row to FileResponse', () => {
    const result = toFileResponse(mockFileRow);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(mockFileRow.id);
    expect(result?.key).toBe(mockFileRow.storageKey);
    expect(result?.originalFilename).toBe(mockFileRow.originalFileName);
    expect(result?.size).toBe(1024);
    expect(result?.status).toBe('ready');
    expect(result?.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should return null for null input', () => {
    const result = toFileResponse(null);
    expect(result).toBeNull();
  });

  it('should map processing status correctly', () => {
    expect(toFileResponse({ ...mockFileRow, processingStatus: 'pending' })?.status).toBe('uploading');
    expect(toFileResponse({ ...mockFileRow, processingStatus: 'processing' })?.status).toBe('processing');
    expect(toFileResponse({ ...mockFileRow, processingStatus: 'completed' })?.status).toBe('ready');
    expect(toFileResponse({ ...mockFileRow, processingStatus: 'failed' })?.status).toBe('failed');
    expect(toFileResponse({ ...mockFileRow, processingStatus: 'partial' })?.status).toBe('ready');
    expect(toFileResponse({ ...mockFileRow, processingStatus: null })?.status).toBe('ready');
  });

  it('should map deleted files correctly', () => {
    const deletedFile = {
      ...mockFileRow,
      deletedAt: new Date('2024-01-02T00:00:00Z'),
      processingStatus: 'completed' as const,
    };
    const result = toFileResponse(deletedFile);
    expect(result?.status).toBe('deleted');
    expect(result?.deletedAt).toBe('2024-01-02T00:00:00.000Z');
  });

  it('should convert BigInt size to number', () => {
    const largeFile = {
      ...mockFileRow,
      size: BigInt(Number.MAX_SAFE_INTEGER),
    };
    const result = toFileResponse(largeFile);
    expect(result?.size).toBe(Number.MAX_SAFE_INTEGER);
    expect(typeof result?.size).toBe('number');
  });

  it('should handle null deletedAt', () => {
    const result = toFileResponse(mockFileRow);
    expect(result?.deletedAt).toBeNull();
  });
});
