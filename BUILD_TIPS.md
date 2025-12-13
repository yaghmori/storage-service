# Docker Build Tips

## First Build is Slow

The first Docker build will take a long time (10-15 minutes) because:
- pnpm needs to download ~1278 packages
- This is a one-time cost - subsequent builds use cache

## If Build Appears Stuck

The build is likely still running. You can:

1. **Check progress in another terminal:**
   ```bash
   docker ps -a
   docker logs <container-id>
   ```

2. **Monitor the build process:**
   - The build shows progress: "resolved 1278, reused 0, downloaded 1275, added 1275"
   - This means it's actively downloading packages
   - Be patient - this is normal for first build

3. **Cancel and retry with BuildKit (faster):**
   ```bash
   # Enable BuildKit for faster builds
   export DOCKER_BUILDKIT=1
   export COMPOSE_DOCKER_CLI_BUILD=1
   
   # Rebuild
   docker compose -f docker-compose.dev.yml build --no-cache
   ```

## Speed Up Subsequent Builds

1. **Use Docker layer caching:**
   - Don't use `--no-cache` unless necessary
   - Only rebuild when dependencies change

2. **Rebuild specific service:**
   ```bash
   docker compose -f docker-compose.dev.yml build storage-service
   ```

3. **Use BuildKit cache mounts (if available):**
   ```bash
   export DOCKER_BUILDKIT=1
   export COMPOSE_DOCKER_CLI_BUILD=1
   ```

## Alternative: Build in Background

If the build is taking too long, you can:

1. **Let it run in background:**
   ```bash
   docker compose -f docker-compose.dev.yml build > build.log 2>&1 &
   ```

2. **Check progress:**
   ```bash
   tail -f build.log
   ```

## Skip Build and Use Pre-built Images

If you have images already built:
```bash
docker compose -f docker-compose.dev.yml up -d --no-build
```

## Troubleshooting Slow Builds

1. **Check network connection** - slow internet = slow downloads
2. **Use local pnpm store** - configure pnpm to use local cache
3. **Reduce build context** - ensure .dockerignore is working
4. **Use multi-stage builds** - separate dependency installation from runtime

## Expected Build Times

- **First build:** 10-15 minutes (downloading all packages)
- **Subsequent builds (no changes):** 1-2 minutes (using cache)
- **Subsequent builds (code changes only):** 2-5 minutes (reinstalling if needed)

