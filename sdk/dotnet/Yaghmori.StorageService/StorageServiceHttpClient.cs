using System.Net.Http.Headers;
using System.Text.Json;

namespace Yaghmori.StorageService;

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
            _http.DefaultRequestHeaders.TryAddWithoutValidation("x-api-key", options.ApiKey);

        if (!string.IsNullOrWhiteSpace(options.BearerToken))
            _http.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", options.BearerToken);
    }

    public async Task<JsonDocument> GetSignedUrlAsync(string fileId, CancellationToken cancellationToken = default)
    {
        var path = StorageService.HttpPaths.SignedUrl.Replace("{id}", Uri.EscapeDataString(fileId));
        using var res = await _http.GetAsync(path.TrimStart('/'), cancellationToken).ConfigureAwait(false);
        res.EnsureSuccessStatusCode();
        return await JsonDocument.ParseAsync(
            await res.Content.ReadAsStreamAsync(cancellationToken),
            cancellationToken: cancellationToken).ConfigureAwait(false);
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
