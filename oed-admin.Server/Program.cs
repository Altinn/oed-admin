using Microsoft.AspNetCore.Builder;
using oed_admin.Server.Features;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Authz;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Telemetry;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuth(builder.Environment, builder.Configuration);

if (!builder.Environment.IsDevelopment())
{
    builder.Services.AddTelemetry(builder.Configuration);
}
builder.Services.AddOpenApi();
builder.Services.AddOedDatabase(builder.Configuration.GetConnectionString("OedDb") ?? string.Empty);
builder.Services.AddAuthzDatabase(builder.Configuration.GetConnectionString("OedAuthzDb") ?? string.Empty);
builder.Services.AddAltinnClients(builder.Configuration);

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddHttpContextAccessor();

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

app.UseExceptionHandler();

app.Run();