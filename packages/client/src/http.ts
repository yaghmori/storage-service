import {
  fillPath,
  joinUrl,
  resolveHttpBaseUrl,
  type ServiceEndpoint,
} from './config';
import { buildAuthHeaders, type ClientAuth } from './auth';
import { HTTP_PATHS } from './generated';
import type {
  FileMetadataSidecar,
  FileVariantsList,
  ProcessorResult,
  ProcessorResultsList,
} from './schemas';

export type StorageHttpClientOptions = ServiceEndpoint & {
  auth?: ClientAuth | string;
  apiKey?: string;
  /** Optional org UUID; must match the API key's organization when set */
  orgId?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

function unwrapData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

export class StorageHttpClient {
  readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: StorageHttpClientOptions = {}) {
    this.baseUrl = resolveHttpBaseUrl(options);
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    const auth = options.auth ?? (options.apiKey ? { apiKey: options.apiKey } : undefined);
    this.headers = {
      accept: 'application/json',
      ...buildAuthHeaders(auth, 'STORAGE_SERVICE_API_KEY'),
      ...(options.orgId ? { 'x-org-id': options.orgId } : {}),
      ...options.headers,
    };
  }

  async getFile(id: string): Promise<unknown> {
    return this.request('GET', fillPath(HTTP_PATHS.GET_FILE, { id }));
  }

  async deleteFile(id: string): Promise<unknown> {
    return this.request('DELETE', fillPath(HTTP_PATHS.DELETE_FILE, { id }));
  }

  async getSignedUrl(
    id: string,
    options?: { expiresIn?: number; variant?: 'thumbnail' | 'medium' },
  ): Promise<unknown> {
    const params = new URLSearchParams();
    if (options?.expiresIn != null) {
      params.set('expiresIn', String(options.expiresIn));
    }
    if (options?.variant) {
      params.set('variant', options.variant);
    }
    const query = params.toString();
    const path = fillPath(HTTP_PATHS.SIGNED_URL, { id });
    return this.request('GET', query ? `${path}?${query}` : path);
  }

  async health(): Promise<unknown> {
    return this.request('GET', HTTP_PATHS.HEALTH);
  }

  async upload(formData: FormData): Promise<unknown> {
    const headers = { ...this.headers };
    delete (headers as Record<string, string | undefined>)['content-type'];
    const res = await this.fetchImpl(joinUrl(this.baseUrl, HTTP_PATHS.UPLOAD), {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`storage-service HTTP ${res.status} POST ${HTTP_PATHS.UPLOAD}: ${text}`);
    }
    return res.json();
  }

  /** Opt-in direct-to-object-store upload (presigned / multipart). */
  async uploadLarge(
    source: import('./upload-large').UploadLargeSource,
    options?: import('./upload-large').UploadLargeOptions,
  ) {
    const { uploadLarge } = await import('./upload-large');
    return uploadLarge(this, source, options);
  }

  /** Internal helpers used by uploadLarge — stable for SDK extensions. */
  getAuthHeaders(): Record<string, string> {
    return { ...this.headers };
  }

  getFetch(): typeof fetch {
    return this.fetchImpl;
  }

  /** EXIF/IPTC/XMP sidecar from metadata.exif (when that processor has run). */
  async getMetadata(id: string): Promise<FileMetadataSidecar> {
    const raw = await this.request(
      'GET',
      fillPath(HTTP_PATHS.METADATA, { id }),
    );
    return unwrapData<FileMetadataSidecar>(raw);
  }

  /** All processor results for a file (OCR, AI vision, EXIF, …). */
  async getProcessorResults(id: string): Promise<ProcessorResultsList> {
    const raw = await this.request(
      'GET',
      fillPath(HTTP_PATHS.PROCESSOR_RESULTS, { id }),
    );
    return unwrapData<ProcessorResultsList>(raw);
  }

  /** One processor result by key, e.g. `document.ocr` or `ai.vision`. */
  async getProcessorResult(
    id: string,
    processorKey: string,
  ): Promise<ProcessorResult> {
    const raw = await this.request(
      'GET',
      fillPath(HTTP_PATHS.PROCESSOR_RESULT, { id, processorKey }),
    );
    return unwrapData<ProcessorResult>(raw);
  }

  /** Generated variants (thumbnail, medium, normalized, …). */
  async getVariants(id: string): Promise<FileVariantsList> {
    const raw = await this.request(
      'GET',
      fillPath(HTTP_PATHS.VARIANTS, { id }),
    );
    return unwrapData<FileVariantsList>(raw);
  }

  /**
   * Convenience: OCR text from document.ocr (or document.text if OCR empty).
   * Returns null when neither has usable text yet.
   */
  async getExtractedText(id: string): Promise<{
    text: string;
    source: 'document.ocr' | 'document.text';
    status: string | null;
    model?: string | null;
  } | null> {
    const ocr = await this.getProcessorResult(id, 'document.ocr');
    const ocrText =
      ocr.data && typeof ocr.data.text === 'string' ? ocr.data.text.trim() : '';
    if (ocrText) {
      return {
        text: ocrText,
        source: 'document.ocr',
        status: ocr.status ?? null,
        model: ocr.model,
      };
    }

    const native = await this.getProcessorResult(id, 'document.text');
    const nativeText =
      native.data && typeof native.data.text === 'string'
        ? native.data.text.trim()
        : '';
    if (nativeText) {
      return {
        text: nativeText,
        source: 'document.text',
        status: native.status ?? null,
        model: native.model,
      };
    }
    return null;
  }

  /**
   * Poll until OCR/native text appears or attempts are exhausted.
   * Domain structured extraction stays in the consumer app.
   */
  async waitForExtractedText(
    id: string,
    options?: { attempts?: number; intervalMs?: number },
  ): Promise<{
    text: string;
    source: 'document.ocr' | 'document.text';
    status: string | null;
    model?: string | null;
  } | null> {
    const attempts = options?.attempts ?? 8;
    const intervalMs = options?.intervalMs ?? 2500;
    for (let i = 0; i < attempts; i++) {
      try {
        const hit = await this.getExtractedText(id);
        if (hit?.text) return hit;
      } catch {
        // File/org may not be ready — keep polling.
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
    return null;
  }

  private async request<T>(method: string, path: string): Promise<T> {
    const res = await this.fetchImpl(joinUrl(this.baseUrl, path), {
      method,
      headers: this.headers,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`storage-service HTTP ${res.status} ${method} ${path}: ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

export function createStorageHttpClient(options?: StorageHttpClientOptions): StorageHttpClient {
  return new StorageHttpClient(options);
}
