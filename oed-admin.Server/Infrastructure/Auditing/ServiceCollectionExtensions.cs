using Microsoft.Extensions.Azure;
using oed_admin.Server.Infrastructure.Auditing.Loggers;

namespace oed_admin.Server.Infrastructure.Auditing;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAuditLogging(
        this IServiceCollection services,
        IHostEnvironment env,
        IConfiguration configuration)
    {
        if (env.IsDevelopment())
        {
            return services.AddTransient<IAuditLogger, LogAuditLogger>();
        }

        services.AddAzureClients(azureClientFactoryBuilder =>
        {
            azureClientFactoryBuilder.AddTableServiceClient(
                new Uri(configuration["AzureTableService:ServiceUri"]!));
        });

        services.AddTransient<IAuditLogger, AzureTableAuditLogger>();

        return services;
    }
}