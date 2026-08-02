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

## MinIO internal vs public endpoint

When the API runs in Docker, set provider `endpoint` to the internal hostname (`minio`) so uploads work.
Set `publicEndpoint` (or env `MINIO_PUBLIC_ENDPOINT`) to the browser-reachable base URL used for signed URLs:

- Local: `http://localhost:9000`
- Production: `https://cdn.allyfe.org` (or your MinIO/S3 proxy)

Without `publicEndpoint`, presigned URLs embed the internal host and browsers cannot open them.

Optional provider field `signedUrlExpiresIn` (seconds, 60–604800) sets the default TTL when the
caller omits `expiresIn`. Explicit request/query TTL always wins.

## HTTP base URL

The Nest app uses global prefix `/api`. The Node SDK appends `/api` when missing, so both
`http://localhost:6100` and `http://localhost:6100/api` work. Prefer including `/api` explicitly
in `STORAGE_SERVICE_URL` for clarity.

## Uploads

- Prefer multipart HTTP (`POST /upload`) over TCP for binaries.
- Retry 408/429/5xx with backoff; do not retry non-idempotent uploads without hash awareness.
- Short-lived signed URLs for browsers/CDN.
