#!/bin/sh
# Create DB if missing, apply migrations, seed initial data when empty.
#
# Usage:
#   seed
#   seed --force
#   docker exec <storage-service-container> seed
set -eu

if [ -f /app/dist/seed.js ]; then
  cd /app
  exec node dist/seed.js "$@"
fi

if [ -f /app/api/dist/seed.js ]; then
  cd /app/api
  exec node dist/seed.js "$@"
fi

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/dist/seed.js" ]; then
  cd "$ROOT"
  exec node dist/seed.js "$@"
fi
if [ -f "$ROOT/api/dist/seed.js" ]; then
  cd "$ROOT/api"
  exec node dist/seed.js "$@"
fi

echo "seed: could not find dist/seed.js (looked in /app and /app/api)" >&2
exit 1
