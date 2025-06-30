using System.Threading.Channels;

namespace oed_admin.Server.Infrastructure.DataMigration;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddDataMigrationService(this IServiceCollection services)
    {
        var channel = Channel.CreateUnbounded<DataMigrationTrigger>(new UnboundedChannelOptions() { SingleReader = true });
        
        services.AddSingleton(channel);
        services.AddHostedService<InstanceToDbDataMigration>();
        
        return services;
    }
}