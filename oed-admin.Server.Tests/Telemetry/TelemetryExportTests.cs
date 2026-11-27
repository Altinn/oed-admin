using System.Net;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using oed_admin.Server.Infrastructure.Telemetry;

namespace oed_admin.Server.Tests.Telemetry;

/// <summary>
/// Runs <see cref="ServiceCollectionExtensions.AddTelemetry"/> against a fake Application Insights ingestion endpoint
/// and checks what actually leaves the process (Altinn/oed#1935).
/// </summary>
public class TelemetryExportTests
{
    private const string LogMarker = "telemetry-test request log line";

    [Fact]
    public async Task RequestTimeLogLines_AreAllExported()
    {
        await using var ingestion = await FakeIngestion.Start();

        const int requestCount = 40;
        await using (var app = await StartApp(ingestion.Url))
        {
            using var http = new HttpClient { BaseAddress = new Uri(app.Urls.First()) };
            // A page in the SPA fires several calls at once; send them as a burst.
            var responses = await Task.WhenAll(Enumerable.Range(0, requestCount).Select(i => http.GetAsync($"/log/{i}")));
            Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        } // disposing the host flushes the exporters

        // With the distro's defaults, 1 request of 40 and none of these lines got through: only startup logs did.
        Assert.Equal(requestCount, ingestion.Messages.Count(m => m.Contains(LogMarker, StringComparison.Ordinal)));
        Assert.Equal(requestCount, ingestion.EnvelopeNames.Count(n => n == "Request"));
    }

    private static async Task<WebApplication> StartApp(string ingestionUrl)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Staging" });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        builder.Services.AddTelemetry(builder.Configuration);
        builder.Services.Configure<AzureMonitorOptions>(o =>
        {
            o.ConnectionString = $"InstrumentationKey={Guid.NewGuid()};IngestionEndpoint={ingestionUrl}";
            o.DisableOfflineStorage = true;
            o.EnableLiveMetrics = false;
        });

        var app = builder.Build();
        app.MapGet("/log/{i:int}", (int i, ILoggerFactory loggers) =>
        {
            loggers.CreateLogger("oed_admin.Server.Features.Test").LogWarning(LogMarker + " {Index}", i);
            return Results.Ok();
        });
        await app.StartAsync();
        return app;
    }
}
