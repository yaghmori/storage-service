namespace Yaghmori.StorageService;

/// <summary>Easy NestJS TCP client for storage-service.</summary>
public sealed class StorageServiceTcpClient : IAsyncDisposable
{
    private readonly NestJsTcpClient _tcp;

    public StorageServiceTcpClient(StorageServiceOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        _tcp = new NestJsTcpClient(options.Host, options.TcpPort, options.Timeout);
    }

    public StorageServiceTcpClient(string host, int port, TimeSpan? timeout = null)
        : this(new StorageServiceOptions { Host = host, TcpPort = port, Timeout = timeout ?? TimeSpan.FromSeconds(30) })
    {
    }

    public Task<T?> GetSignedUrlAsync<T>(object request, CancellationToken cancellationToken = default)
        => _tcp.SendAsync<T>(StorageService.Patterns.GetSignedUrl, request, cancellationToken);

    public Task<T?> GetFileInfoAsync<T>(object request, CancellationToken cancellationToken = default)
        => _tcp.SendAsync<T>(StorageService.Patterns.GetFileInfo, request, cancellationToken);

    public Task<T?> DeleteFileAsync<T>(object request, CancellationToken cancellationToken = default)
        => _tcp.SendAsync<T>(StorageService.Patterns.DeleteFile, request, cancellationToken);

    public Task<T?> ListProcessorResultsAsync<T>(object request, CancellationToken cancellationToken = default)
        => _tcp.SendAsync<T>(StorageService.Patterns.ListProcessorResults, request, cancellationToken);

    public Task<T?> GetProcessorResultAsync<T>(object request, CancellationToken cancellationToken = default)
        => _tcp.SendAsync<T>(StorageService.Patterns.GetProcessorResult, request, cancellationToken);

    public Task<T?> GetFileMetadataAsync<T>(object request, CancellationToken cancellationToken = default)
        => _tcp.SendAsync<T>(StorageService.Patterns.GetFileMetadata, request, cancellationToken);

    public Task<T?> ListVariantsAsync<T>(object request, CancellationToken cancellationToken = default)
        => _tcp.SendAsync<T>(StorageService.Patterns.ListVariants, request, cancellationToken);

    public Task<T?> SendAsync<T>(string pattern, object? data, CancellationToken cancellationToken = default)
        => _tcp.SendAsync<T>(pattern, data, cancellationToken);

    public ValueTask DisposeAsync() => _tcp.DisposeAsync();
}
