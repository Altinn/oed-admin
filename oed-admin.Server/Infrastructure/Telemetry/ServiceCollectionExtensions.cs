using Azure.Monitor.OpenTelemetry.Exporter;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace oed_admin.Server.Infrastructure.Telemetry;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddTelemetry(this IServiceCollection services, IConfiguration config)
    {
        var ai_connstr = config.GetValue<string>("APPLICATIONINSIGHTS_CONNECTION_STRING", string.Empty);
        if (!string.IsNullOrEmpty(ai_connstr))
        {
            services.AddOpenTelemetry()
                .ConfigureResource(resource => resource
                    .AddService("oed-admin-api")
                )
                .WithTracing(tracing => tracing
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddEntityFrameworkCoreInstrumentation()
                    .AddAzureMonitorTraceExporter(o =>
                    {
                        o.ConnectionString = ai_connstr;
                    })
                )
                .WithMetrics(metrics => metrics
                    .AddAspNetCoreInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddAzureMonitorMetricExporter(o =>
                    {
                        o.ConnectionString = ai_connstr;
                    })
                );
        }

        return services;
    }
}