# Best practices — storage-service client

See also email-service `docs/BEST_PRACTICES.md` (same transport / auth model).

- **HTTP** for signed URL / upload from apps with `x-api-key`.
- **TCP** for internal Nest↔Nest or .NET↔Nest (`StorageServiceTcpClient`).
- **Kafka** for async file events (`StorageService.Topics.*`).
- Configure with `STORAGE_SERVICE_*` env or `StorageServiceOptions` — any host/port.
- Keep TCP private; do not expose `TCP_PORT` publicly.
