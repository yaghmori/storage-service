using Microsoft.Extensions.DependencyInjection;

namespace Yaghmori.StorageService;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddStorageServiceClient(
        this IServiceCollection services,
        Action<StorageServiceOptions>? configure = null)
    {
        services.AddSingleton(sp =>
        {
            var options = new StorageServiceOptions();
            configure?.Invoke(options);
            return options;
        });
        services.AddTransient<StorageServiceTcpClient>();
        services.AddTransient<StorageServiceHttpClient>();
        services.AddTransient(_ => new StorageKafkaProducer(new StorageKafkaOptions()));
        return services;
    }
}
