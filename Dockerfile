# Standalone production image for @platform/storage-service
# TCP default: 4002 (platform assets — not deployment artifacts)

# ============================================================================
# Stage 1: Install + build
# ============================================================================
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate \
 && apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install && pnpm rebuild sharp || true

COPY tsconfig.json tsconfig.app.json tsup.config.ts drizzle.config.ts nodemon.json ./
COPY src ./src

RUN pnpm run build

# ============================================================================
# Stage 2: Production runtime
# ============================================================================
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate \
 && apk add --no-cache netcat-openbsd

ENV HOST=0.0.0.0
ENV PORT=4000
ENV TCP_PORT=4002
ENV NODE_ENV=production

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --ignore-scripts \
 && pnpm rebuild sharp || true

COPY --from=build /app/dist ./dist
COPY drizzle.config.ts ./
COPY src/database/drizzle ./src/database/drizzle

RUN addgroup -g 1001 -S nodejs \
 && adduser -S nestjs -u 1001 \
 && mkdir -p /app/uploads \
 && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 4000 4002

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD nc -z localhost ${PORT:-4000} || exit 1

CMD ["node", "dist/main.js"]
