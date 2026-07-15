# @yaghmori/storage-service

Configurable client for **storage-service** (HTTP · TCP · Kafka · auth).

## Docs

- **[docs/PROTOCOL_GUIDE.md](./docs/PROTOCOL_GUIDE.md)** — full HTTP / TCP / Kafka for Node and .NET
- **[docs/USAGE.md](./docs/USAGE.md)** — practical usage
- **[docs/NUGET_TRUSTED_PUBLISHING.md](./docs/NUGET_TRUSTED_PUBLISHING.md)** — publish `Yaghmori.StorageService` without API keys

SDKs: npm · `sdk/dotnet`

```ts
import { createStorageHttpClient } from "@yaghmori/storage-service";

const storage = createStorageHttpClient({
  baseUrl: process.env.STORAGE_SERVICE_URL,
  auth: { apiKey: process.env.STORAGE_SERVICE_API_KEY! },
});
```
