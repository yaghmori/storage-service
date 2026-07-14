# @yaghmori/storage-service

Client SDK for **storage-service** — HTTP, TCP, Kafka.  
Defaults are suggestions; connect to **any host/port/URL**.

## Quick start

```bash
pnpm add @yaghmori/storage-service zod
```

```ts
import { createStorageHttpClient, StorageService } from '@yaghmori/storage-service';

const storage = createStorageHttpClient({
  baseUrl: process.env.STORAGE_SERVICE_URL ?? 'http://localhost:4000',
});

await storage.getSignedUrl(id);
```

## Full guide

See **[docs/USAGE.md](./docs/USAGE.md)**.

## Constants

`StorageService.httpPaths` · `StorageService.patterns` · `StorageService.topics` · `StorageService.ports`
