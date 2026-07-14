import {
  fillPath,
  joinUrl,
  resolveHttpBaseUrl,
  type ServiceEndpoint,
} from './config';
import { HTTP_PATHS } from './generated';

export type StorageHttpClientOptions = ServiceEndpoint & {
  apiKey?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

export class StorageHttpClient {
  readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: StorageHttpClientOptions = {}) {
    this.baseUrl = resolveHttpBaseUrl(options);
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = {
      accept: 'application/json',
      ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
      ...options.headers,
    };
  }

  async getFile(id: string): Promise<unknown> {
    return this.request('GET', fillPath(HTTP_PATHS.GET_FILE, { id }));
  }

  async deleteFile(id: string): Promise<unknown> {
    return this.request('DELETE', fillPath(HTTP_PATHS.DELETE_FILE, { id }));
  }

  async getSignedUrl(id: string): Promise<unknown> {
    return this.request('GET', fillPath(HTTP_PATHS.SIGNED_URL, { id }));
  }

  async health(): Promise<unknown> {
    return this.request('GET', HTTP_PATHS.HEALTH);
  }

  /**
   * POST /upload with multipart body. Pass a FormData (browser/Node 18+).
   * Field name is typically `file` — match your deployment.
   */
  async upload(formData: FormData): Promise<unknown> {
    const headers = { ...this.headers };
    delete headers['content-type'];
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

  private async request<T>(method: string, path: string): Promise<T> {
    const res = await this.fetchImpl(joinUrl(this.baseUrl, path), {
      method,
      headers: {
        ...this.headers,
        ...(method !== 'GET' && method !== 'DELETE'
          ? { 'content-type': 'application/json' }
          : {}),
      },
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
