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

Canonical (from `@platform/messaging-contracts`):

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

| Protocol | Default |
|----------|---------|
| HTTP | `4000` |
| TCP | `4002` |

## Contracts

Depends on [`@platform/messaging-contracts`](https://www.npmjs.com/package/@platform/messaging-contracts) (`^0.1.0` from npm).

## Docker

```bash
docker compose build
docker compose up
```

## License

MIT
