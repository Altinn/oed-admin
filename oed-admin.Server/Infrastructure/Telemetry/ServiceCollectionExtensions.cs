using Azure.Monitor.OpenTelemetry.AspNetCore;
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
            .UseAzureMonitor(ConfigureSampling);

        return services;
    }

    /// <summary>
    /// Never logs below <paramref name="floor"/>, whatever the configuration says. Runs after every configuration
    /// source (appsettings, App Service settings, environment variables), also on reload, and raises any lower level,
    /// for every provider and category, to the floor. A level above the floor (such as <c>Microsoft.AspNetCore</c> at
    /// <c>Warning</c>) stays as it is.
    /// </summary>
    public static IServiceCollection AddLogLevelFloor(this IServiceCollection services, LogLevel floor = LogLevel.Information)
    {
        services.PostConfigure<LoggerFilterOptions>(options =>
        {
            if (options.MinLevel < floor)
                options.MinLevel = floor;

            for (var i = 0; i < options.Rules.Count; i++)
            {
                var rule = options.Rules[i];
                if (rule.LogLevel is { } level && level < floor)
                    options.Rules[i] = new LoggerFilterRule(rule.ProviderName, rule.CategoryName, floor, rule.Filter);
            }
        });

        return services;
    }

    /// <summary>
    /// Keeps every trace and every log line (Altinn/oed#1935). The distro's default since 1.5.0 is a rate-limited
    /// sampler that, for a burst of requests, keeps almost none of them. Trace-based log sampling then drops each log
    /// line written inside a dropped request, so only startup logs reached Application Insights. The OED_M endpoints
    /// log who asked and what oed answered, so those lines must not depend on sampling. Traffic here is a handful of
    /// staff, so 100 % costs little.
    /// </summary>
    private static void ConfigureSampling(AzureMonitorOptions options)
    {
        options.SamplingRatio = 1.0F;
        options.TracesPerSecond = null;
        options.EnableTraceBasedLogsSampler = false;
    }
}
