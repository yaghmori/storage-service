# Storage Service - Complete Usage Guide

This guide covers everything you need to know to use the Storage Service.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Running the Service](#running-the-service)
4. [API Endpoints](#api-endpoints)
5. [Integration Examples](#integration-examples)
6. [Docker Usage](#docker-usage)

## Quick Start

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)
- Redis (v7+)
- pnpm (or npm/yarn)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Environment

```bash
# Copy example environment file
cp apps/storage-service/env.example apps/storage-service/.env

# Edit the .env file with your configuration
```

### 3. Setup Database

```bash
# Start PostgreSQL (if not running)
# Then run migrations
cd apps/storage-service
npx drizzle-kit push

# Seed initial data (optional)
npx ts-node --project tsconfig.app.json -r tsconfig-paths/register src/database/seed/seed.ts
```

### 4. Start the Service

```bash
# Using Nx
nx serve storage-service

# Or directly
cd apps/storage-service
npm run start:dev
```

The service will start on:
- **HTTP API**: http://localhost:4000/api
- **TCP Microservice**: localhost:4001

## Configuration

### Environment Variables

Create a `.env` file in `apps/storage-service/`:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/storage_service
DB_HOST=localhost
DB_PORT=5432
DB_NAME=storage_service
DB_USER=postgres
DB_PASSWORD=postgres

# Redis Configuration (for BullMQ job queues)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Storage Configuration
DEFAULT_STORAGE_PROVIDER=local  # Options: local, minio, s3
MAX_FILE_SIZE=104857600  # 100MB in bytes
ALLOWED_MIME_TYPES=  # Comma-separated, empty = all allowed
UPLOAD_PATH=./uploads

# Server Configuration
PORT=4000  # HTTP API port
TCP_HOST=0.0.0.0
TCP_PORT=4001  # TCP microservice port

# MinIO Configuration (Optional - S3-compatible storage)
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
AWS_S3_ACTIVE=false
```

## Running the Service

### Development Mode

```bash
# Using Nx (recommended)
nx serve storage-service

# Or using npm/pnpm
cd apps/storage-service
npm run start:dev
```

### Production Mode

```bash
# Build the service
nx build storage-service

# Run the built service
node apps/storage-service/dist/main.js
```

### Using Docker

```bash
# Development with hot-reload
docker compose -f docker-compose.dev.yml up

# Production
docker compose -f docker-compose.prod.yml up -d
```

## API Endpoints

All endpoints are prefixed with `/api`.

### 1. Upload File

**Endpoint**: `POST /api/upload`

**Content-Type**: `multipart/form-data`

**Body**:
- `file` (file): The file to upload
- `storageProviderId` (optional, number): Specific storage provider ID

**Example using cURL**:

```bash
curl -X POST http://localhost:4000/api/upload \
  -F "file=@/path/to/your/file.jpg" \
  -F "storageProviderId=1"
```

**Example using JavaScript/TypeScript**:

```typescript
const formData = new FormData();
formData.append('file', fileBlob, 'filename.jpg');
formData.append('storageProviderId', '1');

const response = await fetch('http://localhost:4000/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log(result);
// {
//   id: "uuid",
//   filename: "filename.jpg",
//   mimeType: "image/jpeg",
//   size: 12345,
//   storageProviderId: 1,
//   createdAt: "2024-01-01T00:00:00.000Z",
//   ...
// }
```

**Response**:
```json
{
  "id": "uuid",
  "filename": "original-filename.jpg",
  "mimeType": "image/jpeg",
  "size": 12345,
  "storageProviderId": 1,
  "path": "/path/to/file",
  "checksum": "sha256-hash",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. Get File Information

**Endpoint**: `GET /api/files/:id`

**Example**:

```bash
curl http://localhost:4000/api/files/{file-id}
```

**Response**:
```json
{
  "id": "uuid",
  "filename": "filename.jpg",
  "mimeType": "image/jpeg",
  "size": 12345,
  "storageProviderId": 1,
  "path": "/path/to/file",
  "checksum": "sha256-hash",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 3. Delete File

**Endpoint**: `DELETE /api/files/:id`

**Query Parameters**:
- `hard` (optional, boolean): If `true`, permanently deletes the file. Default: `false` (soft delete)

**Example**:

```bash
# Soft delete (default)
curl -X DELETE http://localhost:4000/api/files/{file-id}

# Hard delete (permanent)
curl -X DELETE "http://localhost:4000/api/files/{file-id}?hard=true"
```

**Response**: `204 No Content` on success

### 4. Download File

**Endpoint**: `GET /api/files/:id/download`

**Query Parameters**:
- `variant` (optional, string): Download a specific variant (e.g., "thumbnail", "preview")
- `size` (optional, number): Resize image to specific size in pixels

**Example**:

```bash
# Download original file
curl http://localhost:4000/api/files/{file-id}/download -o downloaded-file.jpg

# Download thumbnail variant
curl "http://localhost:4000/api/files/{file-id}/download?variant=thumbnail" -o thumbnail.jpg

# Download resized image
curl "http://localhost:4000/api/files/{file-id}/download?size=800" -o resized.jpg
```

**Response**: File stream with appropriate `Content-Type` header

### 5. Get Signed URL

**Endpoint**: `GET /api/files/:id/signed-url`

**Query Parameters**:
- `variant` (optional, string): Get signed URL for a specific variant
- `expiresIn` (optional, number): Expiration time in seconds (default: 3600)

**Example**:

```bash
curl "http://localhost:4000/api/files/{file-id}/signed-url?expiresIn=7200"
```

**Response**:
```json
{
  "url": "https://s3.amazonaws.com/bucket/file.jpg?signature=...",
  "expiresIn": 7200
}
```

## Integration Examples

### Option 1: HTTP REST API (Any Language/Framework)

#### JavaScript/TypeScript

```typescript
class StorageServiceClient {
  constructor(private baseUrl: string = 'http://localhost:4000') {}

  async uploadFile(file: File, storageProviderId?: number) {
    const formData = new FormData();
    formData.append('file', file);
    if (storageProviderId) {
      formData.append('storageProviderId', storageProviderId.toString());
    }

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getFileInfo(id: string) {
    const response = await fetch(`${this.baseUrl}/api/files/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to get file info: ${response.statusText}`);
    }
    return response.json();
  }

  async deleteFile(id: string, hardDelete = false) {
    const url = `${this.baseUrl}/api/files/${id}${hardDelete ? '?hard=true' : ''}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  }

  async getSignedUrl(id: string, expiresIn = 3600) {
    const response = await fetch(
      `${this.baseUrl}/api/files/${id}/signed-url?expiresIn=${expiresIn}`
    );
    return response.json();
  }
}

// Usage
const client = new StorageServiceClient('http://localhost:4000');

// Upload a file
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const uploadedFile = await client.uploadFile(file);
console.log('Uploaded:', uploadedFile);

// Get file info
const fileInfo = await client.getFileInfo(uploadedFile.id);
console.log('File info:', fileInfo);

// Get signed URL
const { url } = await client.getSignedUrl(uploadedFile.id, 7200);
console.log('Signed URL:', url);
```

#### Python

```python
import requests

class StorageServiceClient:
    def __init__(self, base_url='http://localhost:4000'):
        self.base_url = base_url

    def upload_file(self, file_path, storage_provider_id=None):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {}
            if storage_provider_id:
                data['storageProviderId'] = storage_provider_id
            
            response = requests.post(
                f'{self.base_url}/api/upload',
                files=files,
                data=data
            )
            response.raise_for_status()
            return response.json()

    def get_file_info(self, file_id):
        response = requests.get(f'{self.base_url}/api/files/{file_id}')
        response.raise_for_status()
        return response.json()

    def delete_file(self, file_id, hard_delete=False):
        url = f'{self.base_url}/api/files/{file_id}'
        if hard_delete:
            url += '?hard=true'
        response = requests.delete(url)
        response.raise_for_status()

    def get_signed_url(self, file_id, expires_in=3600):
        response = requests.get(
            f'{self.base_url}/api/files/{file_id}/signed-url',
            params={'expiresIn': expires_in}
        )
        response.raise_for_status()
        return response.json()

# Usage
client = StorageServiceClient('http://localhost:4000')
uploaded = client.upload_file('/path/to/file.jpg')
print(f"Uploaded file ID: {uploaded['id']}")
```

### Option 2: TCP Microservice (NestJS Services)

See [STORAGE_CLIENT_EXAMPLE.md](./STORAGE_CLIENT_EXAMPLE.md) for detailed NestJS integration guide.

**Quick Example**:

```typescript
// storage-client.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { StorageClientService } from './storage-client.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'STORAGE_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.STORAGE_SERVICE_HOST || 'localhost',
          port: parseInt(process.env.STORAGE_SERVICE_PORT || '4001', 10),
        },
      },
    ]),
  ],
  providers: [StorageClientService],
  exports: [StorageClientService],
})
export class StorageClientModule {}

// storage-client.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class StorageClientService {
  constructor(
    @Inject('STORAGE_SERVICE') private readonly client: ClientProxy,
  ) {}

  async getFileInfo(id: string) {
    return firstValueFrom(
      this.client.send('get_file_info', { id }),
    );
  }

  async deleteFile(id: string, hardDelete = false) {
    return firstValueFrom(
      this.client.send('delete_file', { id, hardDelete }),
    );
  }
}

// your.service.ts
import { Injectable } from '@nestjs/common';
import { StorageClientService } from './storage-client.service';

@Injectable()
export class YourService {
  constructor(private readonly storageClient: StorageClientService) {}

  async processFile(fileId: string) {
    const fileInfo = await this.storageClient.getFileInfo(fileId);
    // Process file...
  }
}
```

## Docker Usage

### Development

```bash
# Start all services (PostgreSQL, Redis, Storage Service)
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f storage-service

# Stop services
docker compose -f docker-compose.dev.yml down
```

### Production

```bash
# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f storage-service
```

### Environment Variables in Docker

When using Docker, configure connection URLs:

```env
# For services connecting to storage-service
STORAGE_SERVICE_URL=http://storage-service:4000
STORAGE_SERVICE_HOST=storage-service
STORAGE_SERVICE_PORT=4001
```

## Testing the Service

### Health Check

```bash
# Check if service is running
curl http://localhost:4000/api/files/test-id
# Should return 404 (file not found) or 200 (if file exists)
```

### Upload Test

```bash
# Create a test file
echo "Hello, Storage Service!" > test.txt

# Upload it
curl -X POST http://localhost:4000/api/upload \
  -F "file=@test.txt"

# Save the file ID from response, then test download
curl http://localhost:4000/api/files/{file-id}/download
```

## Common Use Cases

### 1. Image Upload and Serving

```typescript
// Upload image
const imageFile = await uploadFile(imageBlob);

// Get thumbnail URL
const { url } = await getSignedUrl(imageFile.id, 3600, 'thumbnail');

// Use in your app
<img src={url} alt="Thumbnail" />
```

### 2. File Management

```typescript
// Upload file
const file = await uploadFile(fileBlob);

// Store file ID in your database
await db.files.create({ 
  userId: user.id, 
  storageFileId: file.id 
});

// Later, delete when user removes it
await deleteFile(file.id, true); // Hard delete
```

### 3. Batch Operations (TCP only)

```typescript
// Using TCP microservice
const results = await storageClient.batchOperations([
  { type: 'get', id: 'file-id-1' },
  { type: 'delete', id: 'file-id-2', hardDelete: true },
  { type: 'get', id: 'file-id-3' },
]);
```

## Troubleshooting

### Service Won't Start

1. Check PostgreSQL is running: `pg_isready`
2. Check Redis is running: `redis-cli ping`
3. Check environment variables are set correctly
4. Check ports 4000 and 4001 are not in use

### Connection Issues

1. **TCP Connection Failed**: Ensure `STORAGE_SERVICE_HOST` and `STORAGE_SERVICE_PORT` are correct
2. **HTTP Connection Failed**: Check `STORAGE_SERVICE_URL` is correct
3. **Docker Network**: Use service names (e.g., `storage-service`) instead of `localhost`

### File Upload Issues

1. Check `MAX_FILE_SIZE` is sufficient
2. Check `ALLOWED_MIME_TYPES` if configured
3. Check storage provider is active and configured correctly

## Next Steps

- See [STORAGE_CLIENT_EXAMPLE.md](./STORAGE_CLIENT_EXAMPLE.md) for detailed integration examples
- Check [README.md](./README.md) for project overview
- Review [QUICK_START.md](./QUICK_START.md) for development setup

