# Best practices — storage-service client

See also email-service `docs/BEST_PRACTICES.md` (same transport / auth model).

- **HTTP** for signed URL / upload from apps with `x-api-key`.
- **TCP** for internal Nest↔Nest or .NET↔Nest (`StorageServiceTcpClient`).
- **Kafka** for async file events (`StorageService.Topics.*`).
- Configure with `STORAGE_SERVICE_*` env or `StorageServiceOptions` — any host/port.
- Keep TCP private; do not expose `TCP_PORT` publicly.

## Multi-tenant orgs

- API keys are **org-bound**. The key implies `orgId`; uploads, reads, and deletes are scoped to that org.
- Optional `x-org-id` header (or SDK `orgId` option) must **match** the key’s org when set.
- Static `AUTH_API_KEYS` use `AUTH_DEFAULT_ORG_ID` (set after seed).
- **Duplicate-by-hash is per org** — the same bytes in org A and org B are separate objects.
- Never log full signed URLs or storage keys.

## Delivery (app-signed URLs)

Clients only ever see your domain. `getAssetUrl` / `GET /v1/files/:id/signed-url` returns:

```text
https://cdn.allyfe.org/v1/files/{fileId}/download?exp=&sig=&variant=
```

`sig` is HMAC from storage-service (`FILES_SIGNING_SECRET`), not AWS/MinIO.

- Set `FILES_PUBLIC_BASE_URL` to the public origin (no trailing slash), e.g. `https://cdn.allyfe.org`.
- Point NPM `cdn.allyfe.org` at **storage-service HTTP** (port 4200), never at MinIO.
- Private MinIO / local disk: the download handler **streams** bytes.
- R2 / AWS (private bucket, public S3 API): the handler **302**s to a short presigned GET.

Do not put MinIO on the internet. Do not set MinIO `browserEndpoint` in production.

Optional provider field `signedUrlExpiresIn` (seconds, 60–604800) sets the default TTL when the
caller omits `expiresIn`. Explicit request/query TTL always wins.

## HTTP base URL

Set `STORAGE_SERVICE_URL` to the host origin (`http://localhost:6100`). Public HTTP paths
are `/v1/...` (for example `POST /v1/upload`). A trailing `/api` on the base URL is stripped.

## Uploads

- Prefer multipart HTTP (`POST /v1/upload`) over TCP for binaries (files within `MAX_FILE_SIZE`, default 100MB).
- **Large files:** use `uploadLarge()` / `POST /v1/upload/initiate` → PUT to the object store → `POST /v1/upload/complete` only when the provider is browser-reachable (R2/S3). Private MinIO and local disk stay on `POST /v1/upload` (proxy limit, default 100MB).
- Align reverse-proxy `client_max_body_size` and timeouts with `MAX_FILE_SIZE` for the small path.
- Set `DIRECT_UPLOAD_MAX_FILE_SIZE` (default 5GB) for the direct path org ceiling.
- Retry 408/429/5xx with backoff; do not retry non-idempotent uploads without hash awareness.
- Short-lived signed URLs for browsers/CDN.

## Rate limits & migration

- Default HTTP throttle: `RATE_LIMIT_MAX` / `RATE_LIMIT_TTL_MS` (120 / 60s).
- Exempt migrate keys via `RATE_LIMIT_EXEMPT_SERVICE_NAMES` (default includes `migration`) or API key `permissions: { "migration": true }`.
- Bulk migrate with `skipProcessing=true` (or `x-skip-processing: true`), then enable processors (including virus scan) after cutover.
- Set `RATE_LIMIT_DISABLED=true` only on trusted networks during cutover if needed.

## Virus scan (ClamAV)

- Run `clamav/clamav` on the internal Docker network; workers use `CLAMAV_HOST=clamav` / `CLAMAV_PORT=3310`.
- Create an org processor backend kind `clamav` (baseUrl `clamav:3310` or host/port) and enable `security.virus_scan`.
- Infected files are soft-deleted (quarantined) and stop serving.