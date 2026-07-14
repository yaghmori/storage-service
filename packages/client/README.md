# @yaghmori/storage-service

Client SDK for **storage-service**. Docker + this package — no hardcoded ports/patterns.

```bash
pnpm add @yaghmori/storage-service zod
docker pull ghcr.io/yaghmori/storage-service:latest
```

```ts
import { StorageService, storageTcpClient } from '@yaghmori/storage-service';

StorageService.ports.tcp;           // 4002
StorageService.patterns.GET_SIGNED_URL;
StorageService.topics.FILE_UPLOADED;
```

.NET: `Yaghmori.StorageService` — constants under `StorageService.Ports` / `.Patterns` / `.Topics`.

Edit `contracts.json`, run `pnpm run codegen`. Publish on `main` via CD (`NPM_TOKEN`, optional `NUGET_TOKEN`).
