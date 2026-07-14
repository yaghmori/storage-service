using Confluent.Kafka;
using System.Text.Json;

namespace Yaghmori.StorageService;

public sealed class StorageKafkaProducer : IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly JsonSerializerOptions _json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public StorageKafkaProducer(StorageKafkaOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var config = new ProducerConfig
        {
            BootstrapServers = options.BootstrapServers,
            ClientId = options.ClientId,
            Acks = Acks.All,
            EnableIdempotence = true,
            MessageSendMaxRetries = options.Retries,
            LingerMs = options.LingerMs,
        };

        if (options.Ssl)
            config.SecurityProtocol = SecurityProtocol.Ssl;

        if (!string.IsNullOrWhiteSpace(options.SaslUsername))
        {
            config.SecurityProtocol = options.Ssl
                ? SecurityProtocol.SaslSsl
                : SecurityProtocol.SaslPlaintext;
            config.SaslMechanism = options.SaslMechanism switch
            {
                "scram-sha-256" => SaslMechanism.ScramSha256,
                "scram-sha-512" => SaslMechanism.ScramSha512,
                _ => SaslMechanism.Plain,
            };
            config.SaslUsername = options.SaslUsername;
            config.SaslPassword = options.SaslPassword;
        }

        _producer = new ProducerBuilder<string, string>(config).Build();
    }

    public async Task<DeliveryResult<string, string>> PublishAsync<T>(
        string topic,
        T payload,
        string? key = null,
        CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(payload, _json);
        return await _producer.ProduceAsync(
            topic,
            new Message<string, string>
            {
                Key = key ?? Guid.NewGuid().ToString("N"),
                Value = json,
            },
            cancellationToken).ConfigureAwait(false);
    }

    public void Dispose() => _producer.Dispose();
}

public sealed class StorageKafkaOptions
{
    public string BootstrapServers { get; set; } =
        Environment.GetEnvironmentVariable("KAFKA_BROKERS")
        ?? Environment.GetEnvironmentVariable("KAFKA_BOOTSTRAP_SERVERS")
        ?? "localhost:9092";

    public string ClientId { get; set; } =
        Environment.GetEnvironmentVariable("KAFKA_CLIENT_ID") ?? "storage-service-dotnet-client";

    public bool Ssl { get; set; } =
        Environment.GetEnvironmentVariable("KAFKA_SSL") is "true" or "1";

    public string? SaslUsername { get; set; } =
        Environment.GetEnvironmentVariable("KAFKA_SASL_USERNAME")
        ?? Environment.GetEnvironmentVariable("KAFKA_USERNAME");

    public string? SaslPassword { get; set; } =
        Environment.GetEnvironmentVariable("KAFKA_SASL_PASSWORD")
        ?? Environment.GetEnvironmentVariable("KAFKA_PASSWORD");

    public string SaslMechanism { get; set; } =
        Environment.GetEnvironmentVariable("KAFKA_SASL_MECHANISM") ?? "plain";

    public int Retries { get; set; } = 3;
    public double LingerMs { get; set; } = 5;
}
