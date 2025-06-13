using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Infrastructure.Database.Authz;

public static class ServiceCollectionExtension
{
    public static IServiceCollection AddAuthzDatabase(this IServiceCollection services, string connectionString)
    {
        services.AddDbContextPool<AuthzDbContext>(opt =>
            opt
                .UseNpgsql(connectionString)
                .UseSnakeCaseNamingConvention()
        );

        return services;
    }

        
}