#!/bin/sh
# Apply pending Drizzle migrations (creates the database if missing).
#
# Usage:
#   migrate
#   docker exec <storage-service-container> migrate
set -eu

if [ -f /app/dist/migrate.js ]; then
  cd /app
  exec node dist/migrate.js "$@"
fi

if [ -f /app/api/dist/migrate.js ]; then
  cd /app/api
  exec node dist/migrate.js "$@"
fi

echo "migrate: could not find dist/migrate.js (looked in /app and /app/api)" >&2
exit 1
