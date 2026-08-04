# Responsive storage under load

## Default production shape

| Service | Role | Flags |
|---------|------|--------|
| `api` / `storage-service` | HTTP + enqueue only | `ENABLE_HTTP=true`, `ENABLE_WORKERS=false`, `ENABLE_CRONS=false` |
| `worker` / `storage-worker` | BullMQ processors + crons | `ENABLE_HTTP=false`, `ENABLE_WORKERS=true`, `ENABLE_CRONS=true` |

Shared Postgres, Redis, and MinIO. Admin UI talks to the API only.

Single-process still works if you set `ENABLE_WORKERS=true` on one container (dev fallback).

## Tuning load (preferred)

Admin → **Settings → Processing** (per org, per processor):

- **Concurrency** / optional rate limits on each enabled processor
- Disable a processor with its Active switch

During a large migrate with `--process`, keep OCR/vision concurrency at `1`.

Platform BullMQ worker concurrency (env / defaults) is only a hard ceiling. True per-org limits are enforced in the worker gate.

## Scaling workers (rare)

Only when Jobs **Waiting** stays high **and** the one worker CPU is pegged **and** Admin concurrency is already reasonable:

```bash
# storage-service monorepo (dev compose)
docker compose -f apps/api/docker-compose.dev.yml up -d --scale worker=2

# docker-services host
docker compose up -d --scale storage-worker=2
```

Do **not** spawn workers from Admin. BullMQ shares work across replicas automatically.

## PDF preview → OCR

Workers must have `poppler-utils` (`pdftoppm`) and preferably `tesseract-ocr` (already in Dockerfiles).

For PDFs, `document.ocr` is deferred until `document.preview` succeeds so a page JPEG exists. Skip reasons appear on the job detail sheet.

Verify:

```bash
docker exec <worker-container> which pdftoppm
```

## Migrator with processing ON

```bash
pnpm storage:migrate -- --process --category=all
# defaults with --process: concurrency=3, pace-ms=50
pnpm storage:migrate -- --process --concurrency=2 --pace-ms=100 --limit=100
```
