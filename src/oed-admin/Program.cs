using Azure.Monitor.OpenTelemetry.Exporter;
using oed_admin.Features.Estate;
using oed_admin.Infrastructure.Database;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Scalar.AspNetCore;
using System;
using oed_admin.Features;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.AddOedDatabase(
    (builder.Environment.IsDevelopment()
        ? builder.Configuration.GetConnectionString("Postgres")
        : builder.Configuration.GetSection("OedConfig:Postgres:ConnectionString").Value) 
    ?? string.Empty);

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
// Add services to the container.

builder.Services.AddControllersWithViews();
builder.Services.AddEndpointsApiExplorer();


var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.MapFeatureEndpoints();

app.UseHttpsRedirection();
app.UseAuthorization();
app.UseStaticFiles();
app.UseRouting();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller}/{action=Index}/{id?}");

app.MapFallbackToFile("index.html");;

app.Run();
