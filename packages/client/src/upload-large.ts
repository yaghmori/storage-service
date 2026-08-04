import { createHash } from 'crypto';
import { readFile, open as fsOpen } from 'fs/promises';
import { basename } from 'path';
import { HTTP_PATHS } from './generated';
import type { StorageHttpClient } from './http';

export type UploadLargeSource =
  | { kind: 'buffer'; buffer: Buffer; filename: string; mimeType: string }
  | { kind: 'file'; path: string; filename?: string; mimeType?: string };

export type UploadLargeOptions = {
  storageProviderId?: string;
  storageKey?: string;
  skipProcessing?: boolean;
  /** Force multipart even below server threshold. */
  multipart?: boolean;
  /**
   * Prefer multipart when size exceeds this (client hint).
   * Server may still force multipart via MULTIPART_THRESHOLD.
   */
  multipartThreshold?: number;
  partSize?: number;
  onProgress?: (progress: {
    phase: 'initiate' | 'upload' | 'complete';
    loaded: number;
    total: number;
  }) => void;
};

export type UploadLargeResult = {
  id: string;
  originalFileName?: string;
  mimeType?: string;
  size?: number;
  isDuplicate?: boolean;
  storageKey?: string;
  uploadedToStorage?: boolean;
  [key: string]: unknown;
};

function unwrapData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

async function sha256Buffer(buffer: Buffer): Promise<string> {
  return createHash('sha256').update(buffer).digest('hex');
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  const fh = await fsOpen(path, 'r');
  try {
    const stream = fh.createReadStream();
    for await (const chunk of stream) {
      hash.update(chunk as Buffer);
    }
  } finally {
    await fh.close();
  }
  return hash.digest('hex');
}

/**
 * Opt-in large upload: initiate → PUT/parts to object store → complete.
 * Does not change {@link StorageHttpClient.upload}.
 */
export async function uploadLarge(
  client: StorageHttpClient,
  source: UploadLargeSource,
  options: UploadLargeOptions = {},
): Promise<UploadLargeResult> {
  const fetchImpl = client.getFetch();
  const headers = { ...client.getAuthHeaders() };

  let buffer: Buffer | null = null;
  let filePath: string | null = null;
  let filename: string;
  let mimeType: string;
  let size: number;

  if (source.kind === 'buffer') {
    buffer = source.buffer;
    filename = source.filename;
    mimeType = source.mimeType || 'application/octet-stream';
    size = buffer.length;
  } else {
    filePath = source.path;
    filename = source.filename || basename(source.path);
    mimeType = source.mimeType || 'application/octet-stream';
    const fh = await fsOpen(source.path, 'r');
    try {
      size = (await fh.stat()).size;
    } finally {
      await fh.close();
    }
  }

  options.onProgress?.({ phase: 'initiate', loaded: 0, total: size });

  const initiateRes = await fetchImpl(
    joinClientUrl(client.baseUrl, HTTP_PATHS.UPLOAD_INITIATE),
    {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        filename,
        mimeType,
        size,
        storageProviderId: options.storageProviderId,
        storageKey: options.storageKey,
        skipProcessing: options.skipProcessing,
        multipart:
          options.multipart === true ||
          (options.multipartThreshold != null &&
            size > options.multipartThreshold),
      }),
    },
  );
  if (!initiateRes.ok) {
    const text = await initiateRes.text().catch(() => '');
    throw new Error(
      `storage-service HTTP ${initiateRes.status} POST initiate: ${text}`,
    );
  }
  const initiated = unwrapData<{
    fileId: string;
    uploadUrl?: string | null;
    method: 'PUT' | 'MULTIPART';
    uploadId?: string;
    partSize?: number;
    partCount?: number;
    headers?: Record<string, string>;
  }>(await initiateRes.json());

  const parts: Array<{ partNumber: number; etag: string }> = [];
  let loaded = 0;

  try {
    if (initiated.method === 'MULTIPART') {
      const partSize = options.partSize || initiated.partSize || 16 * 1024 * 1024;
      const partCount =
        initiated.partCount || Math.max(1, Math.ceil(size / partSize));

      if (!buffer && filePath) {
        buffer = await readFile(filePath);
      }
      if (!buffer) throw new Error('No upload bytes available');

      for (let partNumber = 1; partNumber <= partCount; partNumber++) {
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, size);
        const chunk = buffer.subarray(start, end);

        const partUrlRes = await fetchImpl(
          joinClientUrl(client.baseUrl, HTTP_PATHS.UPLOAD_MULTIPART_PART_URL),
          {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({
              fileId: initiated.fileId,
              partNumber,
            }),
          },
        );
        if (!partUrlRes.ok) {
          const text = await partUrlRes.text().catch(() => '');
          throw new Error(
            `storage-service HTTP ${partUrlRes.status} part-url: ${text}`,
          );
        }
        const partInfo = unwrapData<{ uploadUrl: string }>(
          await partUrlRes.json(),
        );
        const putRes = await fetchImpl(partInfo.uploadUrl, {
          method: 'PUT',
          body: new Uint8Array(chunk),
        });
        if (!putRes.ok) {
          const text = await putRes.text().catch(() => '');
          throw new Error(`Object store part PUT failed ${putRes.status}: ${text}`);
        }
        const etag =
          putRes.headers.get('etag') ||
          putRes.headers.get('ETag') ||
          `"part-${partNumber}"`;
        parts.push({ partNumber, etag: etag.replace(/"/g, '') });
        loaded = end;
        options.onProgress?.({ phase: 'upload', loaded, total: size });
      }
    } else {
      if (!initiated.uploadUrl) {
        throw new Error('initiate did not return uploadUrl');
      }
      if (!buffer && filePath) {
        buffer = await readFile(filePath);
      }
      if (!buffer) throw new Error('No upload bytes available');

      const putRes = await fetchImpl(initiated.uploadUrl, {
        method: 'PUT',
        headers: initiated.headers,
        body: new Uint8Array(buffer),
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => '');
        throw new Error(`Object store PUT failed ${putRes.status}: ${text}`);
      }
      loaded = size;
      options.onProgress?.({ phase: 'upload', loaded, total: size });
    }

    const sha256Hash = buffer
      ? await sha256Buffer(buffer)
      : filePath
        ? await sha256File(filePath)
        : '';

    options.onProgress?.({ phase: 'complete', loaded: size, total: size });

    const completeRes = await fetchImpl(
      joinClientUrl(client.baseUrl, HTTP_PATHS.UPLOAD_COMPLETE),
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          fileId: initiated.fileId,
          sha256Hash,
          skipProcessing: options.skipProcessing,
          parts: parts.length ? parts : undefined,
        }),
      },
    );
    if (!completeRes.ok) {
      const text = await completeRes.text().catch(() => '');
      throw new Error(
        `storage-service HTTP ${completeRes.status} POST complete: ${text}`,
      );
    }
    return unwrapData<UploadLargeResult>(await completeRes.json());
  } catch (error) {
    await fetchImpl(joinClientUrl(client.baseUrl, HTTP_PATHS.UPLOAD_ABORT), {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ fileId: initiated.fileId }),
    }).catch(() => undefined);
    throw error;
  }
}

function joinClientUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
