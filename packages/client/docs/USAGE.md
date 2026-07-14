# Full SDK usage — @yaghmori/storage-service

HTTP + TCP + Kafka names + auth. Deploy on **any host/port**; configure the SDK.

## Install / run

```bash
pnpm add @yaghmori/storage-service zod
docker pull ghcr.io/yaghmori/storage-service:latest
```

```bash
docker run --rm -p 9000:9000 -p 5002:5002 \
  -e PORT=9000 -e TCP_PORT=5002 \
  -e AUTH_API_KEYS=dev-key \
  -e DATABASE_URL=... \
  ghcr.io/yaghmori/storage-service:latest
```

## Configure address / ports

| | Client options | Client env | Service env |
|--|----------------|------------|-------------|
| HTTP | `baseUrl` / `host`+`port` | `STORAGE_SERVICE_URL` or `HOST`+`HTTP_PORT` | `PORT` |
| TCP | `storageTcpClient({ host, port })` | `STORAGE_SERVICE_HOST`, `STORAGE_SERVICE_TCP_PORT` | `TCP_PORT` |
| Kafka | `StorageKafka.connection()` | `KAFKA_BROKERS`, SASL_*, SSL | same |

## Auth (HTTP)

Same contract as email-service:

| Mode | Service config | Client |
|------|----------------|--------|
| API key | `AUTH_API_KEYS=k1,k2` | `auth: { apiKey }` → `x-api-key` |
| JWT | `JWT_SECRET` + Bearer with `serviceName` | `auth: { bearerToken }` |
| Open | `AUTH_DISABLED=true` | omit auth |
| Health | always public | `GET /health` |

TCP: private network. Kafka: broker SASL/SSL via env (not HTTP API keys).

```ts
import { createStorageHttpClient } from '@yaghmori/storage-service';

const storage = createStorageHttpClient({
  baseUrl: process.env.STORAGE_SERVICE_URL,
  auth: { apiKey: process.env.STORAGE_SERVICE_API_KEY! },
});
```

## HTTP

```ts
await storage.upload(formData);
await storage.getFile(id);
await storage.getSignedUrl(id);
await storage.deleteFile(id);
await storage.health();
```

## Nest TCP

```ts
import { ClientsModule } from '@nestjs/microservices';
import { storageTcpClient, StorageService } from '@yaghmori/storage-service';

ClientsModule.register([
  storageTcpClient({
    host: process.env.STORAGE_SERVICE_HOST ?? 'storage-service',
    port: Number(process.env.STORAGE_SERVICE_TCP_PORT ?? 4002),
  }),
]);

// client.send(StorageService.patterns.GET_SIGNED_URL, { id })
```

## Kafka

```ts
import { Kafka } from 'kafkajs';
import { StorageKafka, StorageService } from '@yaghmori/storage-service';

const conn = StorageKafka.connection();
const kafka = new Kafka({
  clientId: conn.clientId,
  brokers: conn.brokers,
  ssl: conn.ssl,
  sasl: conn.sasl as any,
});

// Consume / produce using package topic names:
StorageService.topics.FILE_UPLOADED;
StorageService.eventTypes.UPLOADED;
```

## .NET

```xml
<PackageReference Include="Yaghmori.StorageService" Version="0.1.*" />
```

```csharp
using Yaghmori.StorageService;

var baseUrl = Environment.GetEnvironmentVariable("STORAGE_SERVICE_URL")
    ?? "http://localhost:9000";
using var http = new HttpClient { BaseAddress = new Uri(baseUrl) };
http.DefaultRequestHeaders.Add("x-api-key",
    Environment.GetEnvironmentVariable("STORAGE_SERVICE_API_KEY")!);

var signedPath = StorageService.HttpPaths.SIGNED_URL.Replace("{id}", fileId);
var res = await http.GetAsync(signedPath);

var pattern = StorageService.Patterns.GET_SIGNED_URL;
var topic = StorageService.Topics.FILE_UPLOADED;
```

## Service env

```bash
PORT=9000
TCP_PORT=5002
AUTH_API_KEYS=prod-key
# AUTH_DISABLED=true
JWT_SECRET=...          # optional for Bearer
KAFKA_BROKERS=...
```
