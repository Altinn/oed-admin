using System.Threading.Channels;

namespace oed_admin.Server.Infrastructure.DeclarationPdfMigration;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddDeclarationPdfMigration(this IServiceCollection services)
    {
        // Capacity 1 and Wait: the run guard in DeclarationPdfMigrationState is the real gate
        // against two overlapping runs, so the channel itself should never actually fill up. But
        // if it ever did, Wait is the mode that makes TryWrite return false rather than silently
        // dropping the trigger and reporting success - DropWrite reports true even for a dropped
        // item, which would make StartMigration's endpoint's compensating EndRun unreachable.
        var channel = Channel.CreateBounded<DeclarationPdfMigrationTrigger>(
            new BoundedChannelOptions(1)
            {
                SingleReader = true,
                FullMode = BoundedChannelFullMode.Wait
            });

        services.AddSingleton(channel);
        services.AddSingleton<DeclarationPdfMigrationState>();
        services.AddHostedService<DeclarationPdfMigrationService>();

        return services;
    }
}
