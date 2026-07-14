# @yaghmori/storage-service

Configurable client for **storage-service** (HTTP · TCP · Kafka · auth).

## Docs

**[docs/USAGE.md](./docs/USAGE.md)** — full guide.

```ts
import { createStorageHttpClient } from '@yaghmori/storage-service';

const storage = createStorageHttpClient({
  baseUrl: process.env.STORAGE_SERVICE_URL,
  auth: { apiKey: process.env.STORAGE_SERVICE_API_KEY! },
});
```
