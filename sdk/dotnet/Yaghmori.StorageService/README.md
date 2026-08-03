# Yaghmori.StorageService (.NET)

HTTP + NestJS TCP + Kafka (Confluent.Kafka).

Full guide: [`packages/client/docs/PROTOCOL_GUIDE.md`](../../../../packages/client/docs/PROTOCOL_GUIDE.md)

```csharp
services.AddStorageServiceClient(options =>
{
    // Or set STORAGE_SERVICE_URL / STORAGE_SERVICE_API_KEY / STORAGE_SERVICE_ORG_ID
});
```

### Processor insights (HTTP)

```csharp
await http.GetProcessorResultsAsync(fileId);
await http.GetProcessorResultAsync(fileId, "document.ocr");
await http.GetMetadataAsync(fileId);
await http.GetVariantsAsync(fileId);
var text = await http.GetExtractedTextAsync(fileId);
var ready = await http.WaitForExtractedTextAsync(fileId, attempts: 8);
```

TCP patterns: `storage.list_processor_results`, `storage.get_processor_result`,
`storage.get_file_metadata`, `storage.list_variants`.

## Multi-tenant notes

- HTTP API keys are org-bound (same as the Node SDK).
- Prefer `x-api-key` from a key created in the admin UI for that org.
- Optional `x-org-id` must match the key’s organization.
- TCP legacy `uploadFile` accepts `orgId` / `tenantId`, or the server uses `AUTH_DEFAULT_ORG_ID`.
- Duplicate-by-hash is per organization.
