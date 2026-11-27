using Azure.Monitor.OpenTelemetry.AspNetCore;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Telemetry;

namespace oed_admin.Server.Tests.Telemetry;

/// <summary>
/// An EF Core query, with the deployed appsettings, sends its timing to Application Insights but never its SQL.
/// </summary>
[Collection(PostgresCollection.Name)]
public class SqlTelemetryTests(PostgresFixture fixture)
{
    [Fact]
    public async Task EfCoreQuery_ExportsDependencyWithoutSqlText()
    {
        await using var ingestion = await FakeIngestion.Start();

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Production",
            ContentRootPath = AppContext.BaseDirectory,
        });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        builder.Services.AddTelemetry(builder.Configuration);
        builder.Services.AddLogLevelFloor(LogLevel.Information);
        builder.Services.AddOedDatabase(fixture.ConnectionString);
        builder.Services.Configure<AzureMonitorOptions>(o =>
        {
            o.ConnectionString = $"InstrumentationKey={Guid.NewGuid()};IngestionEndpoint={ingestion.Url}";
            o.DisableOfflineStorage = true;
            o.EnableLiveMetrics = false;
        });

        await using (var app = builder.Build())
        {
            app.MapGet("/q", async (OedDbContext db) =>
            {
                var nin = "01017012345";
                return Results.Ok(await db.Estate.AsNoTracking().Where(e => e.DeceasedNin == nin).CountAsync());
            });
            await app.StartAsync();
            using var http = new HttpClient { BaseAddress = new Uri(app.Urls.First()) };
            (await http.GetAsync("/q")).EnsureSuccessStatusCode();
        } // disposing the host flushes the exporters

        Assert.Contains(ingestion.Envelopes, e => e.Contains("\"type\":\"postgresql\"", StringComparison.Ordinal));
        Assert.DoesNotContain(ingestion.Envelopes, e => e.Contains("deceased_nin", StringComparison.Ordinal));
        Assert.DoesNotContain(ingestion.Envelopes, e => e.Contains("01017012345", StringComparison.Ordinal));
    }
}
