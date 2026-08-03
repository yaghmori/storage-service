# Standalone production image for @yaghmori/storage-service API
# Build from monorepo root:
#   docker build -f apps/api/Dockerfile -t storage-service-api .
#
# Defaults: HTTP 4000 | TCP 4002 — override at runtime with PORT / TCP_PORT / HOST / TCP_HOST

# ============================================================================
# Stage 1: Install + build (bundles @workspace/validation via tsup)
# ============================================================================
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate \
 && apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/validation ./packages/validation
COPY packages/config-typescript ./packages/config-typescript
COPY packages/config-eslint ./packages/config-eslint
COPY apps/api ./apps/api

RUN pnpm install --filter @yaghmori/storage-service-server... --filter @workspace/validation... \
 && pnpm --filter @workspace/validation build \
 && pnpm --filter @yaghmori/storage-service-server build \
 && pnpm rebuild sharp || true

# ============================================================================
# Stage 2: Production runtime (tsup already bundled workspace code)
# ============================================================================
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate \
 && apk add --no-cache netcat-openbsd ffmpeg poppler-utils tesseract-ocr libheif

ENV HOST=0.0.0.0
ENV PORT=4000
ENV TCP_HOST=0.0.0.0
ENV TCP_PORT=4002
ENV NODE_ENV=production

WORKDIR /app

# Install runtime deps without workspace protocol by using the built package tree
COPY apps/api/package.json ./
# Replace workspace dep with a no-op file path so prod install works standalone
RUN node -e "const p=require('./package.json'); delete p.dependencies['@workspace/validation']; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2));" \
 && pnpm install --prod --ignore-scripts \
 && pnpm rebuild sharp || true

COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/drizzle.config.ts ./
COPY --from=build /app/apps/api/src/database/drizzle ./src/database/drizzle

RUN addgroup -g 1001 -S nodejs \
 && adduser -S nestjs -u 1001 \
 && mkdir -p /app/uploads \
 && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 4000 4002

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD-SHELL nc -z localhost $${PORT:-4000} || exit 1

CMD ["node", "dist/main.js"]
