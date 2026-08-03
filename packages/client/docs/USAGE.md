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
await storage.getSignedUrl(id, { variant: 'thumbnail' });
await storage.deleteFile(id);
await storage.health();

// Processing insights (API key + org binding)
const results = await storage.getProcessorResults(id);
const ocr = await storage.getProcessorResult(id, 'document.ocr');
const meta = await storage.getMetadata(id);
const variants = await storage.getVariants(id);
const text = await storage.getExtractedText(id); // document.ocr → document.text
const ready = await storage.waitForExtractedText(id, { attempts: 8, intervalMs: 2500 });
```

Processor results are produced asynchronously after upload. Prefer
`waitForExtractedText` after upload, or poll `getProcessorResult` until `status`
is `completed` / `skipped` / `failed`. Domain extraction (lab JSON, ultrasound
EDD) stays in the app — use storage for raw OCR/text/captions only.

### Consumers

| App | Package | Notes |
|-----|---------|--------|
| eallyfe (`apps/api`) | `@yaghmori/storage-service` | HTTP insights via `StorageService.getExtractedText` / `waitForExtractedText` |
| EAllyfe-Legacy | `Yaghmori.StorageService` | `AiOcrService` prefers storage OCR when `FilePath` is `storage://{guid}` |

Publish: merge SDK changes to `main` → **Storage CD (main)** publishes npm `0.2.x` + NuGet. Then point eallyfe at `^0.2.0` and legacy at `PackageReference Version="0.2.*"`.

## Nest TCP

```ts
import { ClientsModule } from '@nestjs/microservices';
import { storageTcpClient, StorageService } from '@yaghmori/storage-service';

ClientsModule.register([
  storageTcpClient({
    host: process.env.STORAGE_SERVICE_HOST ?? 'storage-service',
    port: Number(process.env.STORAGE_SERVICE_TCP_PORT ?? 6001),
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

### TCP (easiest)

```csharp
using Yaghmori.StorageService;

await using var storage = new StorageServiceTcpClient("storage-service", 5002);

var signed = await storage.GetSignedUrlAsync<JsonElement>(new { id = fileId });
var info = await storage.GetFileInfoAsync<JsonElement>(new { id = fileId });

// Or any pattern
await storage.SendAsync<JsonElement>(StorageService.Patterns.DeleteFile, new { id = fileId });
```

### DI

```csharp
builder.Services.AddStorageServiceClient(o =>
{
    o.Host = "storage-service";
    o.TcpPort = 6001;
    o.BaseUrl = "http://storage-service:6100";
    o.ApiKey = builder.Configuration["Storage:ApiKey"];
});
```

### HTTP

```csharp
using var http = new StorageServiceHttpClient(new StorageServiceOptions
{
    BaseUrl = Environment.GetEnvironmentVariable("STORAGE_SERVICE_URL"),
    ApiKey = Environment.GetEnvironmentVariable("STORAGE_SERVICE_API_KEY"),
});
await http.GetSignedUrlAsync(fileId);
await http.HealthAsync();
```

### Kafka producer + consumer (.NET)

```csharp
using var producer = new StorageKafkaProducer(new StorageKafkaOptions());
await producer.PublishAsync(StorageService.Topics.FileUploaded, new { id = fileId });

using var consumer = new StorageKafkaConsumer(new StorageKafkaOptions(), "media-pipeline");
```


## Full multi-protocol guide

→ **[PROTOCOL_GUIDE.md](./PROTOCOL_GUIDE.md)** — HTTP / TCP / Kafka for Node and .NET.

## Service env

```bash
PORT=9000
TCP_PORT=5002
AUTH_API_KEYS=prod-key
# AUTH_DISABLED=true
JWT_SECRET=...          # optional for Bearer
KAFKA_BROKERS=...
```
