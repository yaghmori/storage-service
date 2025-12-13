# Storage Service Client Integration Guide

This guide shows how to integrate the Storage Service into other microservices.

## Connection Options

The Storage Service exposes two interfaces:

1. **HTTP REST API** (Port 4000) - For HTTP-based communication
2. **TCP Microservice** (Port 4001) - For NestJS microservice-to-microservice communication

## Option 1: TCP Microservice (Recommended for NestJS Services)

For NestJS microservices, use the TCP transport for direct service-to-service communication.

### Step 1: Install Dependencies

```bash
npm install @nestjs/microservices
```

### Step 2: Create a Storage Client Module

```typescript
// storage-client.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { StorageClientService } from './storage-client.service';

const STORAGE_SERVICE_NAME = 'STORAGE_SERVICE';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: STORAGE_SERVICE_NAME,
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
```

### Step 3: Create a Storage Client Service

```typescript
// storage-client.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

const STORAGE_SERVICE_NAME = 'STORAGE_SERVICE';

// Message patterns (must match storage-service/src/files/constants.ts)
const MESSAGE_PATTERNS = {
  GET_FILE_INFO: 'get_file_info',
  DELETE_FILE: 'delete_file',
  BATCH_OPERATIONS: 'batch_operations',
} as const;

@Injectable()
export class StorageClientService {
  constructor(
    @Inject(STORAGE_SERVICE_NAME) private readonly client: ClientProxy,
  ) {}

  async getFileInfo(id: string) {
    return firstValueFrom(
      this.client.send(MESSAGE_PATTERNS.GET_FILE_INFO, { id }),
    );
  }

  async deleteFile(id: string, hardDelete = false) {
    return firstValueFrom(
      this.client.send(MESSAGE_PATTERNS.DELETE_FILE, { id, hardDelete }),
    );
  }

  async batchOperations(
    operations: Array<{ type: string; id: string; hardDelete?: boolean }>,
  ) {
    return firstValueFrom(
      this.client.send(MESSAGE_PATTERNS.BATCH_OPERATIONS, { operations }),
    );
  }
}
```

### Step 4: Use in Your Service

```typescript
// your-service.module.ts
import { Module } from '@nestjs/common';
import { StorageClientModule } from './storage-client/storage-client.module';
import { YourService } from './your.service';

@Module({
  imports: [StorageClientModule],
  providers: [YourService],
})
export class YourServiceModule {}
```

```typescript
// your.service.ts
import { Injectable } from '@nestjs/common';
import { StorageClientService } from './storage-client/storage-client.service';

@Injectable()
export class YourService {
  constructor(private readonly storageClient: StorageClientService) {}

  async processFile(fileId: string) {
    const fileInfo = await this.storageClient.getFileInfo(fileId);
    // Use fileInfo...
  }
}
```

## Option 2: HTTP REST API

For non-NestJS services or when you prefer HTTP:

### Environment Variables

```env
STORAGE_SERVICE_URL=http://localhost:4000
```

### Example Usage

```typescript
// Using fetch
const response = await fetch(`${process.env.STORAGE_SERVICE_URL}/api/files/${fileId}`);
const fileInfo = await response.json();

// Delete file
await fetch(`${process.env.STORAGE_SERVICE_URL}/api/files/${fileId}?hard=true`, {
  method: 'DELETE',
});
```

### Available HTTP Endpoints

- `GET /api/files/:id` - Get file information
- `DELETE /api/files/:id?hard=true` - Delete file (soft or hard delete)
- `POST /api/upload` - Upload a file
- `GET /api/files/:id/download` - Download file
- `GET /api/files/:id/signed-url` - Get signed URL for file access

## Environment Variables

Configure the connection using environment variables:

```env
# For TCP connection
STORAGE_SERVICE_HOST=localhost
STORAGE_SERVICE_PORT=4001

# For HTTP connection
STORAGE_SERVICE_URL=http://localhost:4000
```

## Docker Network Configuration

When running in Docker, use the service name:

```env
STORAGE_SERVICE_HOST=storage-service
STORAGE_SERVICE_PORT=4001
STORAGE_SERVICE_URL=http://storage-service:4000
```

