# Quick Start Guide

## Development Setup

### Start Services

```bash
docker compose -f docker-compose.dev.yml up -d
```

### View Logs

```bash
# All services
docker compose -f docker-compose.dev.yml logs -f

# Specific service
docker compose -f docker-compose.dev.yml logs -f storage-service
```

### Stop Services

```bash
docker compose -f docker-compose.dev.yml down
```

## Service Ports (Development)

| Service             | URL                   | Port | Description              |
| ------------------- | --------------------- | ---- | ------------------------ |
| Storage Service     | http://localhost:4000 | 4000 | Main storage API         |
| Storage Service TCP | -                     | 4001 | TCP microservice         |
| Redis               | -                     | 6380 | Redis (mapped from 6379) |

## Service Endpoints

### Storage Service

- Base URL: `http://localhost:4000/api`
- Upload: `POST /api/upload`
- Files: `GET /api/files/:id`
- Download: `GET /api/files/:id/download`
- Signed URL: `GET /api/files/:id/signed-url`

## Hot Reload

Code changes in these directories are automatically reflected:

- `apps/storage-service/src/**`

No need to restart containers - changes are picked up automatically via nodemon.

## Database (External)

The compose file expects PostgreSQL to be running externally on `localhost:5432`.

If you need to add PostgreSQL to docker-compose, uncomment the postgres service in `docker-compose.dev.yml`.

## Redis

Redis is running in Docker on port 6380 (host) -> 6379 (container).

## Common Commands

```bash
# Rebuild services after dependency changes
docker compose -f docker-compose.dev.yml build

# Rebuild without cache
docker compose -f docker-compose.dev.yml build --no-cache

# Execute commands in containers
docker compose -f docker-compose.dev.yml exec storage-service sh

# Check service status
docker compose -f docker-compose.dev.yml ps

# Restart a specific service
docker compose -f docker-compose.dev.yml restart storage-service
```

## Troubleshooting

### Port Already in Use

If ports 4000, 4001, or 6380 are in use, modify the port mappings in `docker-compose.dev.yml`.

### Code Changes Not Reflecting

1. Ensure files are saved
2. Check container logs: `docker compose -f docker-compose.dev.yml logs storage-service`
3. Verify volume mounts are working

### Database Connection Issues

Ensure PostgreSQL is running on `localhost:5432` with:

- Database: `storage_service`
- User: `postgres`
- Password: `postgres`

### Redis Connection Issues

Redis should be accessible on `localhost:6380` (or the mapped port).
