# Storage Service

NestJS microservice for file storage and asset management with S3-compatible storage support.

## Quick Setup

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Environment Configuration

### .env File Setup

Copy the example file and customize:

```bash
cp apps/storage-service/env.example apps/storage-service/.env
```

Create a `.env` file in the `apps/storage-service` directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/storage_service
DB_HOST=localhost
DB_PORT=5432
DB_NAME=storage_service
DB_USER=postgres
DB_PASSWORD=postgres

# Redis Configuration (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Storage Configuration
DEFAULT_STORAGE_PROVIDER=local
MAX_FILE_SIZE=104857600
ALLOWED_MIME_TYPES=
UPLOAD_PATH=./uploads

# Server Configuration
PORT=3000
TCP_HOST=0.0.0.0
TCP_PORT=3001

# MinIO Configuration (Optional)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=storage
MINIO_USE_SSL=false
MINIO_ACTIVE=true

# AWS S3 Configuration (Optional)
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=your-access-key
AWS_S3_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_S3_ENDPOINT=
AWS_S3_ACTIVE=true
```

## Database Setup

### 1. Run Migrations

Generate and run database migrations using Drizzle:

```bash
# Generate migration files
cd apps/storage-service
npx drizzle-kit generate

# Apply migrations (development - pushes directly)
npx drizzle-kit push

# Or apply migration files (production)
npx drizzle-kit up

# Check schema (validate without applying)
npx drizzle-kit check
```

Or using the Nx commands:

```bash
# Generate migration files
nx run storage-service:migrate:generate

# Push schema (development)
nx run storage-service:migrate

# Apply migrations (production)
nx run storage-service:migrate:up

# Check schema
nx run storage-service:migrate:check
```

### 2. Seed Database

Seed the database with initial storage providers:

```bash
# Using ts-node
npx ts-node apps/storage-service/src/database/seed/seed.ts

# Or using Nx (if configured)
nx run storage-service:seed
```

The seed script will:

- Create a default local storage provider
- Create MinIO provider if environment variables are configured
- Create AWS S3 provider if environment variables are configured

## Running the Service

```bash
# Development
nx serve storage-service

# Production build
nx build storage-service
```

## API Endpoints

### File Upload

- `POST /api/upload` - Upload a file

### File Management

- `GET /api/files/:id` - Get file information
- `DELETE /api/files/:id` - Delete a file

### File Serving

- `GET /api/files/:id/download` - Download a file
- `GET /api/files/:id/download?variant=thumbnail` - Download a variant
- `GET /api/files/:id/signed-url` - Get a signed URL

### Analytics

- `GET /api/analytics/files/:id/stats` - Get download statistics

## TCP Microservice

The service also exposes TCP microservice endpoints:

- `get_file_info` - Get file information
- `delete_file` - Delete a file
- `batch_operations` - Batch file operations
