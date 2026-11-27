using System.Collections.Concurrent;
using System.IO.Compression;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace oed_admin.Server.Tests.Telemetry;

/// <summary>Accepts Breeze <c>/v2.1/track</c> posts and keeps every envelope.</summary>
internal sealed class FakeIngestion : IAsyncDisposable
{
    private readonly WebApplication _app;
    /// <summary>Every envelope, as sent.</summary>
    public ConcurrentBag<string> Envelopes { get; } = [];
    public ConcurrentBag<string> Messages { get; } = [];
    public ConcurrentBag<string> EnvelopeNames { get; } = [];
    public string Url => _app.Urls.First();

    private FakeIngestion(WebApplication app) => _app = app;

    public static async Task<FakeIngestion> Start()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        var app = builder.Build();
        var fake = new FakeIngestion(app);
        app.MapPost("/v2.1/track", async (HttpRequest request) =>
        {
            Stream body = request.Body;
            if (request.Headers.ContentEncoding.ToString().Contains("gzip", StringComparison.OrdinalIgnoreCase))
                body = new GZipStream(body, CompressionMode.Decompress);
            using var reader = new StreamReader(body);
            var count = 0;
            while (await reader.ReadLineAsync() is { } line)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                count++;
            fake.Envelopes.Add(line);
                using var doc = JsonDocument.Parse(line);
                if (doc.RootElement.TryGetProperty("name", out var name)) fake.EnvelopeNames.Add(name.GetString() ?? "");
                if (doc.RootElement.TryGetProperty("data", out var data)
                    && data.TryGetProperty("baseData", out var baseData)
                    && baseData.TryGetProperty("message", out var message))
                    fake.Messages.Add(message.GetString() ?? "");
            }
            return Results.Json(new { itemsReceived = count, itemsAccepted = count, errors = Array.Empty<object>() });
        });
        await app.StartAsync();
        return fake;
    }

    public async ValueTask DisposeAsync() => await _app.DisposeAsync();
}
