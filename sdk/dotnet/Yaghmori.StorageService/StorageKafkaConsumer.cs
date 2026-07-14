using Confluent.Kafka;
using System.Text.Json;

namespace Yaghmori.StorageService;

public sealed class StorageKafkaConsumer : IDisposable
{
    private readonly IConsumer<string, string> _consumer;
    private readonly JsonSerializerOptions _json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public StorageKafkaConsumer(StorageKafkaOptions options, string groupId, IEnumerable<string>? topics = null)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentException.ThrowIfNullOrWhiteSpace(groupId);

        var config = new ConsumerConfig
        {
            BootstrapServers = options.BootstrapServers,
            GroupId = groupId,
            ClientId = options.ClientId + "-consumer",
            EnableAutoCommit = false,
            AutoOffsetReset = AutoOffsetReset.Earliest,
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

        _consumer = new ConsumerBuilder<string, string>(config).Build();
        _consumer.Subscribe(topics?.ToArray()
            ?? new[]
            {
                StorageService.Topics.FileUploaded,
                StorageService.Topics.FileDeleted,
                StorageService.Topics.FileProcessed,
            });
    }

    public ConsumeResult<string, string>? Consume(TimeSpan timeout) => _consumer.Consume(timeout);

    public T? Deserialize<T>(ConsumeResult<string, string> result)
        => JsonSerializer.Deserialize<T>(result.Message.Value, _json);

    public void Commit(ConsumeResult<string, string> result) => _consumer.Commit(result);

    public void Dispose() => _consumer.Dispose();
}
