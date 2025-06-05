using Azure.Monitor.OpenTelemetry.Exporter;
using oed_admin.Extensions;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.UseSwagger();
    app.UseSwaggerUI(); // tilgjengelig på /swagger
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.UseStaticFiles();
app.UseRouting();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller}/{action=Index}/{id?}");

app.MapFallbackToFile("index.html");;

app.Run();
