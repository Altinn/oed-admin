using System.Threading.Channels;

namespace oed_admin.Server.Infrastructure.EstateCount;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddEstateCount(this IServiceCollection services)
    {
        // Capacity 1 and Wait, for the same reason as AddDeclarationPdfMigration: the run guard
        // in EstateCountState is the real gate, and Wait makes TryWrite return false rather than
        // silently dropping a trigger.
        var channel = Channel.CreateBounded<EstateCountTrigger>(
            new BoundedChannelOptions(1)
            {
                SingleReader = true,
                FullMode = BoundedChannelFullMode.Wait
            });

        services.AddSingleton(channel);
        services.AddSingleton<EstateCountState>();
        services.AddHostedService<EstateCountService>();

        return services;
    }
}
