#!/bin/sh
# Apply pending Drizzle migrations (creates the database if missing).
#
# Usage:
#   migrate
#   docker exec <storage-service-container> migrate
#   docker compose run --rm --entrypoint migrate storage-service
set -eu

if [ -f /app/dist/migrate.js ]; then
  cd /app
  exec node dist/migrate.js "$@"
fi

if [ -f /app/api/dist/migrate.js ]; then
  cd /app/api
  exec node dist/migrate.js "$@"
fi

# Local / non-image fallback when script lives next to the app tree
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/dist/migrate.js" ]; then
  cd "$ROOT"
  exec node dist/migrate.js "$@"
fi
if [ -f "$ROOT/api/dist/migrate.js" ]; then
  cd "$ROOT/api"
  exec node dist/migrate.js "$@"
fi

echo "migrate: could not find dist/migrate.js (looked in /app and /app/api)" >&2
exit 1
