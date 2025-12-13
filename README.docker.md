# Docker Setup Guide

This guide explains how to use Docker Compose for both development and production environments.

## Prerequisites

- Docker and Docker Compose installed
- For development: Code changes will be reflected automatically via volume mounts

## Development Setup

### Quick Start

```bash
# Start all services in development mode
docker-compose -f docker-compose.dev.yml up

# Or run in detached mode
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop all services
docker-compose -f docker-compose.dev.yml down
```

### Development Features

- **Hot Reload**: Code changes in `apps/storage-service/src` are automatically reflected
- **Volume Mounts**: Source code is mounted as read-only volumes for live updates
- **All Services**: Includes PostgreSQL, Redis, MinIO, and Storage Service

### Development Ports

- **Storage Service HTTP**: http://localhost:4000
- **Storage Service TCP**: localhost:4001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6380 (mapped from container 6379)
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)
- **MinIO API**: http://localhost:9000

### Running Database Migrations (Development)

```bash
# Enter the storage-service container
docker-compose -f docker-compose.dev.yml exec storage-service sh

# Inside the container, run migrations
cd apps/storage-service
npx drizzle-kit push

# Or seed the database
npx ts-node --project tsconfig.app.json -r tsconfig-paths/register src/database/seed/seed.ts
```

## Production Setup

### Quick Start

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop all services
docker-compose -f docker-compose.prod.yml down
```

### Environment Variables

Create a `.env` file in the root directory for production configuration:

```env
# Database
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=storage_service
DB_PORT=5432

# Redis
REDIS_PASSWORD=your_redis_password
REDIS_PORT=6379
REDIS_DB=0

# Storage Service
STORAGE_PORT=3000
STORAGE_TCP_PORT=3001
DEFAULT_STORAGE_PROVIDER=local
MAX_FILE_SIZE=104857600

# MinIO (Optional)
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ENDPOINT=minio
MINIO_BUCKET=storage
MINIO_USE_SSL=false
MINIO_ACTIVE=true

# AWS S3 (Optional)
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=your_access_key
AWS_S3_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
AWS_S3_ENDPOINT=
AWS_S3_ACTIVE=false
```

### Production Features

- **Optimized Images**: Uses production builds with minimal dependencies
- **Health Checks**: All services include health checks
- **Restart Policies**: Services automatically restart on failure
- **Persistent Volumes**: Data is persisted across container restarts

### Production Ports

- **Storage Service HTTP**: Configured via `STORAGE_PORT` (default: 3000)
- **Storage Service TCP**: Configured via `STORAGE_TCP_PORT` (default: 3001)
- **PostgreSQL**: Configured via `DB_PORT` (default: 5432)
- **Redis**: Configured via `REDIS_PORT` (default: 6379)
- **MinIO**: Configured via `MINIO_PORT` and `MINIO_CONSOLE_PORT`

### Running Database Migrations (Production)

```bash
# Enter the storage-service container
docker-compose -f docker-compose.prod.yml exec storage-service sh

# Inside the container, run migrations
cd apps/storage-service
npx drizzle-kit up
```

### Building Images Separately

```bash
# Build storage-service
docker build -f apps/storage-service/Dockerfile -t storage-service:latest .
```

## Useful Commands

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f storage-service
```

### Execute Commands in Containers

```bash
# Storage service
docker-compose -f docker-compose.dev.yml exec storage-service sh

# Database
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d storage_service
```

### Clean Up

```bash
# Stop and remove containers
docker-compose -f docker-compose.dev.yml down

# Remove volumes (WARNING: This deletes data)
docker-compose -f docker-compose.dev.yml down -v

# Remove images
docker-compose -f docker-compose.dev.yml down --rmi all
```

### Rebuild Services

```bash
# Rebuild specific service
docker-compose -f docker-compose.dev.yml build storage-service

# Rebuild without cache
docker-compose -f docker-compose.dev.yml build --no-cache storage-service
```

## Troubleshooting

### Port Conflicts

If ports are already in use, modify the port mappings in the docker-compose files or stop the conflicting services.

### Permission Issues (Linux)

If you encounter permission issues with volumes:

```bash
sudo chown -R $USER:$USER ./apps/storage-service/uploads
```

### Hot Reload Not Working

Ensure that:
1. Volume mounts are correctly configured
2. Files are saved (not just modified in memory)
3. Nodemon is running (check container logs)

### Database Connection Issues

Wait for the database to be healthy before starting dependent services. The compose files include health checks and dependencies to handle this automatically.

## MinIO Setup

MinIO is included in both dev and prod setups. To use it:

1. Access the MinIO console at http://localhost:9001
2. Login with credentials (default: minioadmin/minioadmin)
3. Create a bucket named "storage" (or update `MINIO_BUCKET` env var)
4. Update `MINIO_ACTIVE=true` in your environment

## Notes

- Development setup uses volume mounts for hot-reload
- Production setup uses optimized Docker images
- All data is persisted in Docker volumes
- Health checks ensure services start in the correct order
- Network isolation is provided via Docker networks

