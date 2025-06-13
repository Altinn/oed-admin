using Azure.Monitor.OpenTelemetry.Exporter;
using oed_admin.Features;
using oed_admin.Infrastructure.Database.Authz;
using oed_admin.Infrastructure.Database.Oed;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

builder.Services.AddOedDatabase(builder.Configuration.GetConnectionString("OedDb") ?? string.Empty);
builder.Services.AddAuthzDatabase(builder.Configuration.GetConnectionString("OedAuthzDb") ?? string.Empty);

var ai_connstr = builder.Configuration.GetValue<string>("APPLICATIONINSIGHTS_CONNECTION_STRING", string.Empty);
if (!string.IsNullOrEmpty(ai_connstr))
{
    builder.Services.AddOpenTelemetry()
        .ConfigureResource(resource => resource
            .AddService("oed-admin-api")
        )
        .WithTracing(tracing => tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
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

var app = builder.Build();

app.UseDefaultFiles();
app.MapStaticAssets();

app.MapFeatureEndpoints();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.MapFallbackToFile("/index.html");

app.Run();

internal record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
