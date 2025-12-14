# Production Dockerfile for storage-service
# Build the docker image with `npx nx docker:build @org/storage-service`.
# Run the container with `nx docker:run @org/storage-service -p 3000:3000`.

FROM docker.io/node:lts-alpine

# Install netcat for health checks
RUN apk add --no-cache netcat-openbsd

ENV HOST=0.0.0.0
ENV PORT=3000
ENV TCP_PORT=3001
ENV NODE_ENV=production

WORKDIR /app

# Copy the built application and package files from dist
# The dist folder should contain the built files and package.json (created by nx prune)
COPY apps/storage-service/dist .

# Install production dependencies only
# The package.json and package-lock.json in dist are created by nx prune
# and contain only production dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD nc -z localhost ${PORT:-3000} || exit 1

CMD [ "node", "main.js" ]

