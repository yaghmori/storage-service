# @platform/storage-service

![stability-stable](https://img.shields.io/badge/stability-stable-green.svg)

Object storage for **platform assets** — avatars, documents, images, and similar user/content files. Upload, metadata, signed URLs, and optional image processing. Local / MinIO / S3 providers.

> **Not for deployment artifacts.** Build outputs, release tarballs, and deploy packages are out of V1 scope.

## Integrate in 10 minutes

```bash
pnpm install

docker compose up -d postgres redis minio

cp .env.example .env
# DATABASE_URL, REDIS_*, MINIO_* or local UPLOAD_PATH

pnpm db:push
pnpm db:seed

pnpm start:dev
# HTTP :4000  |  TCP :4002
```

Primary integration: **HTTP multipart upload** (`POST /upload`) + signed URL (`GET` serving routes / TCP `storage.get_signed_url`).

## TCP patterns

Canonical (from `src/lib/contracts`):

- `storage.get_file_info`
- `storage.delete_file`
- `storage.batch_operations`
- `storage.get_signed_url`

Legacy Allyfe aliases (delegated in-process):

- `uploadFile` — buffer upload via `UploadService`
- `getAssetUrl` — signed URL
- `deleteAsset` — soft/hard delete

Prefer HTTP upload when calling from languages that already speak multipart.

## Ports

| Protocol | Env | Default |
|----------|-----|---------|
| HTTP bind | `HOST` | `0.0.0.0` |
| HTTP | `PORT` | `4000` |
| TCP bind | `TCP_HOST` | same as `HOST` |
| TCP | `TCP_PORT` | `4002` |

Published images honor these at **runtime** — no rebuild needed:

```bash
docker run --rm -e PORT=7000 -e TCP_PORT=7001 -p 7000:7000 -p 7001:7001 \
  ghcr.io/yaghmori/storage-service:latest
```

Compose: set `PORT` / `TCP_PORT`; publish mappings use `${PORT}:${PORT}` / `${TCP_PORT}:${TCP_PORT}`.

## Contracts

TCP/HTTP envelopes, ports, and Kafka topics live in `src/lib/contracts` (local to this service).

## Docker

```bash
docker compose build
docker compose up
```

## License

MIT
