# Combined production image: Nest API + Next.js admin
# Defaults: HTTP PORT=6000 | TCP_PORT=6001 | ADMIN_PORT=6200
#
# Build from repo root:
#   docker build -t storage-service .

FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate \
 && apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile || pnpm install

RUN pnpm --filter @workspace/validation build \
 && pnpm --filter @yaghmori/storage-service-server build \
 && pnpm --filter admin build \
 && test ! -f apps/api/dist/main.js \
    || ! grep -q "require('@workspace/validation')" apps/api/dist/main.js \
    || (echo "ERROR: dist/main.js still requires @workspace/validation — fix tsup noExternal" && exit 1)

FROM node:20-alpine AS api-deps

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate \
 && apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app/api
COPY apps/api/package.json ./
# tsup noExternal bundles @workspace/validation — drop workspace protocol for standalone prod install
RUN node -e "const p=require('./package.json'); delete p.dependencies['@workspace/validation']; p.scripts={...(p.scripts||{}),migrate:'node dist/migrate.js','db:migrate':'node dist/migrate.js','migrate:prod':'node dist/migrate.js',seed:'node dist/seed.js','db:seed':'node dist/seed.js','seed:prod':'node dist/seed.js'}; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2));" \
 && pnpm install --prod --ignore-scripts \
 && pnpm rebuild sharp || true

FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate \
 && apk add --no-cache netcat-openbsd tini ffmpeg poppler-utils tesseract-ocr libheif \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nestjs -u 1001

ENV HOST=0.0.0.0 \
    PORT=6000 \
    TCP_HOST=0.0.0.0 \
    TCP_PORT=6001 \
    ADMIN_PORT=6200 \
    NODE_ENV=production \
    HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=api-deps --chown=nestjs:nodejs /app/api/node_modules /app/api/node_modules
COPY --from=api-deps --chown=nestjs:nodejs /app/api/package.json /app/api/package.json
COPY --from=build --chown=nestjs:nodejs /app/apps/api/dist /app/api/dist
COPY --from=build --chown=nestjs:nodejs /app/apps/api/drizzle.config.ts /app/api/drizzle.config.ts
COPY --from=build --chown=nestjs:nodejs /app/apps/api/src/database/drizzle /app/api/src/database/drizzle

COPY --from=build --chown=nestjs:nodejs /app/apps/admin/.next/standalone /app/web
COPY --from=build --chown=nestjs:nodejs /app/apps/admin/.next/static /app/web/apps/admin/.next/static

COPY --from=build /app/scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY --from=build /app/scripts/migrate.sh /usr/local/bin/migrate
COPY --from=build /app/scripts/seed.sh /usr/local/bin/seed
COPY --from=build /app/scripts/container-package.json /app/package.json
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh /usr/local/bin/migrate /usr/local/bin/seed \
 && chmod +x /app/docker-entrypoint.sh /usr/local/bin/migrate /usr/local/bin/seed \
 && chown nestjs:nodejs /app/package.json

USER nestjs

EXPOSE 6000 6001 6200

HEALTHCHECK --interval=30s --timeout=3s --start-period=50s --retries=3 \
  CMD sh -c 'if [ "$${ENABLE_HTTP:-true}" = "false" ]; then exit 0; else nc -z localhost $${PORT:-6000} || exit 1; fi'

# Schema + first data:
#   docker exec <container> migrate
#   docker exec <container> seed
# Optional boot: RUN_MIGRATIONS=true RUN_SEED=true
ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
