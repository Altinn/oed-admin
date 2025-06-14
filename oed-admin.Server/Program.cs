using oed_admin.Server.Features;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Telemetry;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddTelemetry(builder.Configuration);
builder.Services.AddOpenApi();
builder.Services.AddOedDatabase(builder.Configuration.GetConnectionString("OedDb") ?? string.Empty);
builder.Services.AddAuthzDatabase(builder.Configuration.GetConnectionString("OedAuthzDb") ?? string.Empty);

var app = builder.Build();

app.UseDefaultFiles();
app.MapStaticAssets();

app.MapFeatureEndpoints();

if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.MapFallbackToFile("/index.html");

app.Run();