# Yaghmori.StorageService (.NET)

HTTP + NestJS TCP + Kafka (Confluent.Kafka).

Full guide: [`packages/client/docs/PROTOCOL_GUIDE.md`](../../../../packages/client/docs/PROTOCOL_GUIDE.md)

```csharp
services.AddStorageServiceClient();
```

## Multi-tenant notes

- HTTP API keys are org-bound (same as the Node SDK).
- Prefer `x-api-key` from a key created in the admin UI for that org.
- Optional `x-org-id` must match the key’s organization.
- TCP legacy `uploadFile` accepts `orgId` / `tenantId`, or the server uses `AUTH_DEFAULT_ORG_ID`.
- Duplicate-by-hash is per organization.
