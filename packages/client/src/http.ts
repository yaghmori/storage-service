import {
  fillPath,
  joinUrl,
  resolveHttpBaseUrl,
  type ServiceEndpoint,
} from './config';
import { buildAuthHeaders, type ClientAuth } from './auth';
import { HTTP_PATHS } from './generated';

export type StorageHttpClientOptions = ServiceEndpoint & {
  auth?: ClientAuth | string;
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
    const auth = options.auth ?? (options.apiKey ? { apiKey: options.apiKey } : undefined);
    this.headers = {
      accept: 'application/json',
      ...buildAuthHeaders(auth, 'STORAGE_SERVICE_API_KEY'),
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
