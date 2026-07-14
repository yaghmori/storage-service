# Using `@yaghmori/storage-service`

SDK for **storage-service**: HTTP + TCP + Kafka constants.  
**Defaults (TCP 4002 / HTTP 4000) are suggestions only** — run the service anywhere and point the SDK at it.

## 1. Run the service (any address)

```bash
docker pull ghcr.io/yaghmori/storage-service:latest

docker run --rm -p 9000:9000 -p 5002:5002 \
  -e PORT=9000 \
  -e TCP_PORT=5002 \
  ghcr.io/yaghmori/storage-service:latest
```

## 2. Install

```bash
pnpm add @yaghmori/storage-service zod
```

## 3. Configure connection

| Goal | Option | Env |
|------|--------|-----|
| Full URL | `baseUrl` | `STORAGE_SERVICE_URL` |
| Host + HTTP | `host`, `port` | `STORAGE_SERVICE_HOST`, `STORAGE_SERVICE_HTTP_PORT` |
| TCP | `host`, `port` | `STORAGE_SERVICE_HOST`, `STORAGE_SERVICE_TCP_PORT` |

## 4. HTTP

```ts
import { createStorageHttpClient, StorageService } from '@yaghmori/storage-service';

const storage = createStorageHttpClient({
  baseUrl: 'https://storage.prod.example.com', // any host/port
});

await storage.health();
await storage.getFile(fileId);
await storage.getSignedUrl(fileId);
await storage.deleteFile(fileId);

const form = new FormData();
form.append('file', blob, 'avatar.png');
await storage.upload(form);

StorageService.httpPaths.SIGNED_URL; // '/files/{id}/signed-url'
```

## 5. NestJS TCP

```ts
import { ClientsModule } from '@nestjs/microservices';
import { storageTcpClient, StorageService } from '@yaghmori/storage-service';

ClientsModule.register([
  storageTcpClient({ host: 'storage-service', port: 5002 }),
]);

// this.client.send(StorageService.patterns.GET_SIGNED_URL, { id })
```

## 6. Kafka

```ts
import { StorageService } from '@yaghmori/storage-service';

StorageService.topics.FILE_UPLOADED;
StorageService.eventTypes.UPLOADED;
```

## 7. .NET

```csharp
using Yaghmori.StorageService;

var path = StorageService.HttpPaths.SIGNED_URL;
var pattern = StorageService.Patterns.GET_SIGNED_URL;
```

## 8. Codegen

`packages/client/contracts.json` → `pnpm run codegen`.
