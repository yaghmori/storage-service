using System.Net.Http.Headers;
using System.Text.Json;

namespace Yaghmori.StorageService;

public sealed class StorageUploadResult
{
    public required Guid Id { get; init; }
    public string? StorageKey { get; init; }
    public string? OriginalFileName { get; init; }
    public string? MimeType { get; init; }
    public long? Size { get; init; }
}

public sealed class StorageServiceHttpClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly bool _ownsHttp;

    public StorageServiceHttpClient(StorageServiceOptions options, HttpClient? httpClient = null)
    {
        ArgumentNullException.ThrowIfNull(options);
        _ownsHttp = httpClient is null;
        _http = httpClient ?? new HttpClient { Timeout = options.Timeout };
        _http.BaseAddress = new Uri(options.ResolveHttpBaseUrl() + "/");

        if (!string.IsNullOrWhiteSpace(options.ApiKey))
            _http.DefaultRequestHeaders.TryAddWithoutValidation("x-api-key", options.ApiKey.Trim());

        if (!string.IsNullOrWhiteSpace(options.OrgId))
            _http.DefaultRequestHeaders.TryAddWithoutValidation("x-org-id", options.OrgId.Trim());

        if (!string.IsNullOrWhiteSpace(options.BearerToken))
            _http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", options.BearerToken);
    }

    public async Task<JsonDocument> GetSignedUrlAsync(
        string fileId,
        CancellationToken cancellationToken = default)
    {
        var path = StorageService.HttpPaths.SignedUrl.Replace("{id}", Uri.EscapeDataString(fileId));
        using var res = await _http.GetAsync(path.TrimStart('/'), cancellationToken).ConfigureAwait(false);
        res.EnsureSuccessStatusCode();
        return await JsonDocument.ParseAsync(
            await res.Content.ReadAsStreamAsync(cancellationToken),
            cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Stream file bytes via storage-service proxy (<c>GET /files/{id}/download</c>).
    /// Prefer this for server-side loads inside Docker — signed MinIO URLs often use
    /// <c>localhost</c> which is unreachable from other containers.
    /// </summary>
    public async Task<byte[]> DownloadBytesAsync(
        string fileId,
        CancellationToken cancellationToken = default)
    {
        var path = StorageService.HttpPaths.Download.Replace("{id}", Uri.EscapeDataString(fileId));
        using var res = await _http.GetAsync(path.TrimStart('/'), cancellationToken).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            throw new HttpRequestException(
                $"storage-service download failed {(int)res.StatusCode}: {body}");
        }

        return await res.Content.ReadAsByteArrayAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Multipart upload to storage-service <c>POST /upload</c>.
    /// Optional <paramref name="storageKey"/> sets a stable object key.
    /// </summary>
    public async Task<StorageUploadResult> UploadAsync(
        Stream content,
        string fileName,
        string contentType,
        string? storageKey = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(content);
        if (string.IsNullOrWhiteSpace(fileName))
            throw new ArgumentException("fileName is required", nameof(fileName));

        using var form = new MultipartFormDataContent();
        var streamContent = new StreamContent(content);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue(
            string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType);
        form.Add(streamContent, "file", fileName);

        if (!string.IsNullOrWhiteSpace(storageKey))
            form.Add(new StringContent(storageKey), "storageKey");

        using var res = await _http
            .PostAsync(StorageService.HttpPaths.Upload.TrimStart('/'), form, cancellationToken)
            .ConfigureAwait(false);
        var body = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException(
                $"storage-service upload failed {(int)res.StatusCode}: {body}");

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var data = root.TryGetProperty("data", out var d) ? d : root;

        var idRaw =
            (data.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String
                ? idEl.GetString()
                : null)
            ?? throw new InvalidOperationException("Upload response missing id");

        if (!Guid.TryParse(idRaw, out var id))
            throw new InvalidOperationException($"Upload response id is not a Guid: {idRaw}");

        return new StorageUploadResult
        {
            Id = id,
            StorageKey = data.TryGetProperty("storageKey", out var sk) && sk.ValueKind == JsonValueKind.String
                ? sk.GetString()
                : null,
            OriginalFileName = data.TryGetProperty("originalFileName", out var ofn)
                && ofn.ValueKind == JsonValueKind.String
                    ? ofn.GetString()
                    : fileName,
            MimeType = data.TryGetProperty("mimeType", out var mt) && mt.ValueKind == JsonValueKind.String
                ? mt.GetString()
                : contentType,
            Size = data.TryGetProperty("size", out var sz) && sz.TryGetInt64(out var size)
                ? size
                : null,
        };
    }

    public async Task<JsonDocument> HealthAsync(CancellationToken cancellationToken = default)
    {
        using var res = await _http.GetAsync(StorageService.HttpPaths.Health.TrimStart('/'), cancellationToken)
            .ConfigureAwait(false);
        res.EnsureSuccessStatusCode();
        return await JsonDocument.ParseAsync(
            await res.Content.ReadAsStreamAsync(cancellationToken),
            cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    public void Dispose()
    {
        if (_ownsHttp) _http.Dispose();
    }
}
