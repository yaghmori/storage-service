# Multi-protocol client guide (storage-service)

Full integration guide for **storage-service** over **HTTP**, **NestJS TCP**, and **Kafka** from **Node.js**, **.NET**. Companion to the email-service protocol guide — same auth, framing, and env conventions, different contracts.

| Artifact | Location |
|----------|----------|
| Truth file | `packages/client/contracts.json` |
| Node SDK | `@yaghmori/storage-service` |
| .NET SDK | `Yaghmori.StorageService` |
| Docker | `ghcr.io/yaghmori/storage-service` |

```bash
cd packages/client && pnpm run codegen
```

Default suggestions: TCP **6001**, HTTP **6100** (override freely; avoid **6000** — blocked by Node fetch).

---

## 1. Protocol selection

| Protocol | Use for | Auth |
|----------|---------|------|
| **HTTP** | Uploads/downloads/signed URLs from apps and gateways | `x-api-key` / Bearer JWT |
| **TCP** | Metadata RPCs (file info, delete, signed URL) inside the mesh | Network trust |
| **Kafka** | Async lifecycle (`file.uploaded` / `deleted` / `processed`) | Cluster SASL/SSL |

Binary uploads are **HTTP multipart** (or your existing upload path). Prefer signing downloads rather than streaming huge files over TCP.

---

## 2. Address resolution

| Client env | Purpose |
|------------|---------|
| `STORAGE_SERVICE_URL` | Full HTTP base |
| `STORAGE_SERVICE_HOST` | Host for TCP/HTTP fallback |
| `STORAGE_SERVICE_TCP_PORT` | TCP dial port |
| `STORAGE_SERVICE_HTTP_PORT` | HTTP dial port if URL omitted |
| `STORAGE_SERVICE_API_KEY` / `STORAGE_SERVICE_BEARER` | HTTP auth |

Service listen: `PORT` (HTTP), `TCP_PORT` (Nest TCP). Kafka: same `KAFKA_*` variables as email-service.

Priority: constructor options → env → contract defaults.

---

## 3. Authentication (HTTP)

Identical header contract to email-service:

- `x-api-key: <key>` (preferred for API keys) — keys are **org-bound** in the DB
- `Authorization: Bearer <jwt>` (service JWT may include `orgId`)
- `Authorization: ApiKey <key>`
- Optional `x-org-id` — must match the API key’s organization when both are set

Service: DB `api_keys`, `AUTH_API_KEYS` (+ `AUTH_DEFAULT_ORG_ID`), `JWT_SECRET`, or `AUTH_DISABLED=true` on trusted meshes only. `GET /health` may be `@Public()`.

Admin UI uses a separate JWT surface under `/admin/api/*` (not the SDK).

Never expose TCP publicly. Never put API keys in `Authorization: Bearer`. Never put admin JWTs in the SDK.

Duplicate file detection (SHA-256) is **per organization**.

---

## 4. HTTP paths (contracts)

| Constant | Path | Notes |
|----------|------|-------|
| `UPLOAD` | `POST /upload` | Multipart / binary upload |
| `GET_FILE` | `GET /files/{id}` | Metadata |
| `DELETE_FILE` | `DELETE /files/{id}` | Soft/hard delete per service |
| `DOWNLOAD` | `GET /files/{id}/download` | HMAC (`exp`+`sig`) or API key; 302 to provider or stream |
| `SIGNED_URL` | `GET /files/{id}/signed-url` | App-signed URL on `FILES_PUBLIC_BASE_URL` |
| `HEALTH` | `GET /health` | Liveness |

SDK HTTP helpers currently emphasize signed URL + health; extend with multipart upload using the same auth headers and `HttpPaths.Upload`.

Best practices:

- Short-lived app-signed URLs for browsers (`<img src>`). Provider hostnames never appear in clients.
- Timeouts longer for upload/download (60–120s) than for metadata.
- Retry 408/429/5xx with backoff; never retry non-idempotent uploads without an idempotency key.
- Do not log storage keys or full signed URLs in cleartext logs.

---

## 5. NestJS TCP

Framing: `<utf8-byte-length>#<json>` (same as email).

| Constant | Pattern |
|----------|---------|
| `GET_FILE_INFO` | `storage.get_file_info` |
| `DELETE_FILE` | `storage.delete_file` |
| `BATCH_OPERATIONS` | `storage.batch_operations` |
| `GET_SIGNED_URL` | `storage.get_signed_url` |
| `UPLOAD_FILE` | `uploadFile` |
| `GET_ASSET_URL` | `getAssetUrl` |
| `DELETE_ASSET` | `deleteAsset` |
| `HEALTH_CHECK` | `health.check` |

Request/response includes `id`; events omit `id`. SDKs throw when response `err` is set.

---

## 6. Kafka

| Topic constant | Topic | Event type |
|----------------|-------|------------|
| `FILE_UPLOADED` | `file.uploaded` | `evt.storage.file.uploaded.v1` |
| `FILE_DELETED` | `file.deleted` | `evt.storage.file.deleted.v1` |
| `FILE_PROCESSED` | `file.processed` | `evt.storage.file.processed.v1` |

Producer defaults: `acks=all`, idempotent, retries, JSON values. Consumers: manual commit, dedicated group IDs, subscribe to the topics above.

Typical pattern: service publishes lifecycle events after successful storage mutations; other services react (thumbnails, antivirus, analytics) without calling TCP on the hot path.

---

## 7. Node.js

```ts
import {
  createStorageHttpClient,
  storageTcpClient,
  StorageService,
  resolveKafkaConnection,
} from '@yaghmori/storage-service';

const http = createStorageHttpClient({
  baseUrl: process.env.STORAGE_SERVICE_URL,
  auth: { apiKey: process.env.STORAGE_SERVICE_API_KEY! },
});

const tcp = storageTcpClient({
  host: process.env.STORAGE_SERVICE_HOST,
  port: Number(process.env.STORAGE_SERVICE_TCP_PORT),
});

const kafkaConn = resolveKafkaConnection();
// pass kafkaConn to kafkajs; use StorageService.topics.*
```

---

## 8. .NET

```csharp
services.AddStorageServiceClient();

await using var tcp = new StorageServiceTcpClient(new StorageServiceOptions
{
    Host = "storage-service",
    TcpPort = 6001,
});
var info = await tcp.GetFileInfoAsync<JsonElement>(new { id = fileId });

using var http = new StorageServiceHttpClient(new StorageServiceOptions
{
    BaseUrl = "https://storage.prod.example.com",
    ApiKey = Environment.GetEnvironmentVariable("STORAGE_SERVICE_API_KEY"),
});
using var signed = await http.GetSignedUrlAsync(fileId);

using var producer = new StorageKafkaProducer(new StorageKafkaOptions());
await producer.PublishAsync(StorageService.Topics.FileUploaded, new { id = fileId });

using var consumer = new StorageKafkaConsumer(new StorageKafkaOptions(), "media-pipeline");
```

`NestJsTcpClient` implements framing. Constants are PascalCase (`StorageService.Patterns.GetSignedUrl`).

---


## 10. Security checklist

- [ ] Authenticated HTTP on every non-health route
- [ ] Private TCP
- [ ] Signed URLs expire and use HTTPS
- [ ] Kafka SASL/SSL in shared clusters
- [ ] Separate API keys per environment
- [ ] No PII in object keys if avoidable; scrub logs

---

## 11. Debugging

| Symptom | Check |
|---------|-------|
| 401 | `x-api-key` vs `AUTH_API_KEYS` |
| Wrong file host | `STORAGE_SERVICE_URL` vs service `PORT` |
| TCP pattern miss | Compare to `contracts.json` (legacy `uploadFile` vs `storage.*`) |
| Signed URL 404 | File id / soft-delete |
| Missed Kafka events | Group id, topic name, consumer lag |

---

## 12. Codegen

Edit `contracts.json` only; regenerate TS/C#. Align breaking path/pattern/topic changes with a SemVer bump of the client packages.

See also [`USAGE.md`](./USAGE.md) and email-service `PROTOCOL_GUIDE.md` for framing/auth deep dives shared across services.
