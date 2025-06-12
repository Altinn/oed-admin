using Microsoft.EntityFrameworkCore;

namespace oed_admin.Infrastructure.Database.Oed;

public static class ServiceCollectionExtension
{
    public static IServiceCollection AddOedDatabase(this IServiceCollection services, string connectionString)
    {
        services.AddDbContextPool<OedDbContext>(opt =>
            opt
                .UseNpgsql(connectionString, builder =>
                    builder.MigrationsHistoryTable("__EFMigrationsHistory", "oed"))
                .UseSnakeCaseNamingConvention()
        );

        return services;
    }

}