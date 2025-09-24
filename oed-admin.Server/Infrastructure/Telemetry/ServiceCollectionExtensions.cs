using Azure.Monitor.OpenTelemetry.AspNetCore;
using Azure.Monitor.OpenTelemetry.Exporter;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace oed_admin.Server.Infrastructure.Telemetry;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddTelemetry(this IServiceCollection services, IConfiguration config)
    {   
        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource
                .AddService("oed-admin-api")
            )
            .WithTracing(tracing => tracing.AddEntityFrameworkCoreInstrumentation())
            .UseAzureMonitor();

        return services;
    }
}