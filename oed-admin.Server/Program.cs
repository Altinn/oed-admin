using oed_admin.Server.Features;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Telemetry;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddTelemetry(builder.Configuration);
builder.Services.AddOpenApi();
builder.Services.AddOedDatabase(builder.Configuration.GetConnectionString("OedDb") ?? string.Empty);
builder.Services.AddAuthzDatabase(builder.Configuration.GetConnectionString("OedAuthzDb") ?? string.Empty);
builder.Services.AddAltinnClients(builder.Configuration);

var app = builder.Build();

app.UseDefaultFiles();
app.MapStaticAssets();

// Registrerer IKKE endepunktene i PROD før vi har validert auth i miljøet
if (!app.Environment.IsProduction())
{
    app.MapFeatureEndpoints();
}

if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.MapFallbackToFile("/index.html");

app.Run();