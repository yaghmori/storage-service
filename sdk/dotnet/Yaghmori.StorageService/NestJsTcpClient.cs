using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Yaghmori.StorageService;

/// <summary>NestJS TCP framing (<c>length#json</c>). Prefer <see cref="StorageServiceTcpClient"/>.</summary>
public sealed class NestJsTcpClient : IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly string _host;
    private readonly int _port;
    private readonly TimeSpan _timeout;

    public NestJsTcpClient(string host, int port, TimeSpan? timeout = null)
    {
        _host = host;
        _port = port;
        _timeout = timeout ?? TimeSpan.FromSeconds(30);
    }

    public async Task<TResponse?> SendAsync<TResponse>(
        string pattern,
        object? data,
        CancellationToken cancellationToken = default)
    {
        var id = Guid.NewGuid().ToString();
        var payload = new Dictionary<string, object?>
        {
            ["pattern"] = pattern,
            ["data"] = data,
            ["id"] = id,
        };

        var response = await ExchangeAsync(payload, cancellationToken).ConfigureAwait(false);
        if (response is null) return default;

        if (response.TryGetPropertyValue("err", out var err) && err is not null && err.GetValueKind() != JsonValueKind.Null)
            throw new InvalidOperationException($"Nest TCP error for '{pattern}': {err}");

        if (!response.TryGetPropertyValue("response", out var body) || body is null)
            return default;

        return body.Deserialize<TResponse>(JsonOptions);
    }

    public async Task EmitAsync(string pattern, object? data, CancellationToken cancellationToken = default)
    {
        await ExchangeAsync(
            new Dictionary<string, object?> { ["pattern"] = pattern, ["data"] = data },
            cancellationToken,
            expectResponse: false).ConfigureAwait(false);
    }

    private async Task<JsonObject?> ExchangeAsync(
        Dictionary<string, object?> payload,
        CancellationToken cancellationToken,
        bool expectResponse = true)
    {
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var framed = $"{Encoding.UTF8.GetByteCount(json)}#{json}";
        var bytes = Encoding.UTF8.GetBytes(framed);

        using var tcp = new TcpClient();
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(_timeout);

        await tcp.ConnectAsync(_host, _port, cts.Token).ConfigureAwait(false);
        await using var stream = tcp.GetStream();
        await stream.WriteAsync(bytes, cts.Token).ConfigureAwait(false);

        if (!expectResponse) return null;

        var buffer = new byte[64 * 1024];
        var received = new StringBuilder();
        while (true)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), cts.Token).ConfigureAwait(false);
            if (read == 0) break;
            received.Append(Encoding.UTF8.GetString(buffer, 0, read));
            var text = received.ToString();
            var hash = text.IndexOf('#');
            if (hash <= 0) continue;
            if (!int.TryParse(text.AsSpan(0, hash), out var len)) continue;
            var bodyStart = hash + 1;
            if (text.Length - bodyStart < len) continue;
            return JsonNode.Parse(text.Substring(bodyStart, len)) as JsonObject;
        }

        throw new TimeoutException($"No TCP response from {_host}:{_port}");
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
