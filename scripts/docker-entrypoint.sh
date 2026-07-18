#!/bin/sh
# Combined storage-service runtime: Nest API + Next admin in one container.
set -eu

API_PORT="${PORT:-6100}"
ADMIN_LISTEN="${ADMIN_PORT:-6200}"
export HOST="${HOST:-0.0.0.0}"
export TCP_HOST="${TCP_HOST:-$HOST}"
export TCP_PORT="${TCP_PORT:-6001}"
export PORT="$API_PORT"
export ADMIN_PORT="$ADMIN_LISTEN"

STORAGE_API_URL="${STORAGE_API_URL:-http://127.0.0.1:${API_PORT}}"
export STORAGE_API_URL

if [ -z "${NEXT_PUBLIC_APP_URL:-}" ] && [ -z "${APP_URL:-}" ] && [ -z "${ADMIN_URL:-}" ]; then
  export NEXT_PUBLIC_APP_URL="http://localhost:${ADMIN_LISTEN}"
fi

API_PID=""
ADMIN_PID=""

shutdown() {
  if [ -n "$ADMIN_PID" ] && kill -0 "$ADMIN_PID" 2>/dev/null; then
    kill "$ADMIN_PID" 2>/dev/null || true
  fi
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  exit 0
}

trap shutdown TERM INT

echo "[entrypoint] API  HOST=${HOST} PORT=${API_PORT} TCP=${TCP_HOST}:${TCP_PORT}"
echo "[entrypoint] Admin ADMIN_PORT=${ADMIN_LISTEN} STORAGE_API_URL=${STORAGE_API_URL}"

cd /app/api
node dist/main.js &
API_PID=$!

cd /app/web
PORT="$ADMIN_LISTEN" \
ADMIN_PORT="$ADMIN_LISTEN" \
HOSTNAME=0.0.0.0 \
STORAGE_API_URL="$STORAGE_API_URL" \
NODE_ENV=production \
  node apps/admin/server.js &
ADMIN_PID=$!

while kill -0 "$API_PID" 2>/dev/null && kill -0 "$ADMIN_PID" 2>/dev/null; do
  sleep 2
done
echo "[entrypoint] a child process exited; shutting down"
shutdown
