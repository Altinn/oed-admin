using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using oed_admin.Server.Infrastructure.Telemetry;

namespace oed_admin.Server.Tests.Telemetry;

public class LogLevelFloorTests
{
    private static ILoggerFactory Build(Dictionary<string, string?> logging)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings { EnvironmentName = "Staging" });
        builder.Logging.ClearProviders();
        builder.Logging.AddConsole();
        // Added last, as an App Service setting or environment variable would be.
        builder.Configuration.AddInMemoryCollection(logging);
        builder.Services.AddLogLevelFloor(LogLevel.Information);
        return builder.Build().Services.GetRequiredService<ILoggerFactory>();
    }

    [Fact]
    public void LowerConfiguredLevels_AreRaisedToInformation()
    {
        var loggers = Build(new()
        {
            ["Logging:LogLevel:Default"] = "Trace",
            ["Logging:LogLevel:oed_admin.Server"] = "Debug",
            ["Logging:Console:LogLevel:oed_admin.Server.Infrastructure"] = "Trace",
        });

        foreach (var category in new[] { "Some.Category", "oed_admin.Server.Features.X", "oed_admin.Server.Infrastructure.Altinn.Y" })
        {
            var logger = loggers.CreateLogger(category);
            Assert.False(logger.IsEnabled(LogLevel.Trace), category);
            Assert.False(logger.IsEnabled(LogLevel.Debug), category);
            Assert.True(logger.IsEnabled(LogLevel.Information), category);
        }
    }

    /// <summary>The checked-in appsettings files, as test (Staging) and prod resolve them with the floor.</summary>
    [Theory]
    [InlineData("Staging")]
    [InlineData("Production")]
    public void DeployedSettings_LogInformationAndAbove_WithoutPerQuerySql(string environment)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            EnvironmentName = environment,
            ContentRootPath = AppContext.BaseDirectory,
        });
        builder.Logging.ClearProviders();
        builder.Logging.AddConsole();
        builder.Services.AddLogLevelFloor(LogLevel.Information);
        var loggers = builder.Build().Services.GetRequiredService<ILoggerFactory>();

        void Lowest(string category, LogLevel expected)
        {
            var logger = loggers.CreateLogger(category);
            Assert.True(logger.IsEnabled(expected), $"{category} should log {expected}");
            Assert.False(logger.IsEnabled(expected - 1), $"{category} should not log {expected - 1}");
        }

        Lowest("oed_admin.Server.Features.Maintenance.OedModel.SetPhase.Endpoint", LogLevel.Information);
        Lowest("Microsoft.Hosting.Lifetime", LogLevel.Information);
        Lowest("System.Net.Http.HttpClient.Default", LogLevel.Information);
        Lowest("Microsoft.AspNetCore.Routing.EndpointMiddleware", LogLevel.Warning);
        Lowest("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
        Lowest("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
        Lowest("Azure.Core", LogLevel.Warning);
        Lowest("Azure.Identity", LogLevel.Warning);
    }

    [Fact]
    public void LevelsAboveTheFloor_AreKept()
    {
        var loggers = Build(new()
        {
            ["Logging:LogLevel:Default"] = "Information",
            ["Logging:LogLevel:Microsoft.AspNetCore"] = "Warning",
        });

        var aspNet = loggers.CreateLogger("Microsoft.AspNetCore.Routing");
        Assert.False(aspNet.IsEnabled(LogLevel.Information));
        Assert.True(aspNet.IsEnabled(LogLevel.Warning));
    }
}
