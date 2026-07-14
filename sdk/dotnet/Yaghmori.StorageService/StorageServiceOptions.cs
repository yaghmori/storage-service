namespace Yaghmori.StorageService;

public sealed class StorageServiceOptions
{
    public string Host { get; set; } =
        Environment.GetEnvironmentVariable(StorageService.Env.Host) ?? "127.0.0.1";

    public int TcpPort { get; set; } =
        int.TryParse(Environment.GetEnvironmentVariable(StorageService.Env.TcpPort), out var p)
            ? p
            : StorageService.Ports.Tcp;

    public string? BaseUrl { get; set; } =
        Environment.GetEnvironmentVariable(StorageService.Env.HttpBaseUrl);

    public int HttpPort { get; set; } =
        int.TryParse(Environment.GetEnvironmentVariable(StorageService.Env.HttpPort), out var hp)
            ? hp
            : StorageService.Ports.Http;

    public string? ApiKey { get; set; } =
        Environment.GetEnvironmentVariable("STORAGE_SERVICE_API_KEY");

    public string? BearerToken { get; set; } =
        Environment.GetEnvironmentVariable("STORAGE_SERVICE_BEARER");

    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);

    public string ResolveHttpBaseUrl()
    {
        if (!string.IsNullOrWhiteSpace(BaseUrl))
            return BaseUrl.TrimEnd('/');
        return $"http://{Host}:{HttpPort}";
    }
}
