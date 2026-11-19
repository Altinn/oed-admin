using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using oed_admin.Server.Features;
using oed_admin.Server.Infrastructure.Authz;

namespace oed_admin.Server.Tests.Features;

/// <summary>
/// /api/qa serves SonarQube findings, security hotspots included. It must not be reachable without a signed-in user
/// holding at least the Read role, now that App Service authentication no longer gates the app.
/// </summary>
public sealed class QaDashboardEndpointTests : IAsyncLifetime
{
    private WebApplication _app = null!;

    public async Task InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddAuth(builder.Environment, builder.Configuration);

        _app = builder.Build();
        _app.MapFeatureEndpoints();
        await _app.StartAsync();
    }

    public async Task DisposeAsync() => await _app.DisposeAsync();

    [Fact]
    public async Task Anonymous_IsRefused()
    {
        using var client = new HttpClient { BaseAddress = new Uri(_app.Urls.First()) };

        var response = await client.GetAsync("/api/qa");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public void RequiresAtLeastTheReadRole()
    {
        var endpoint = ((IEndpointRouteBuilder)_app).DataSources
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(e => e.RoutePattern.RawText == "/api/qa");

        var policies = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy);

        Assert.Contains(AuthorizationPolicies.AtLeastReadRole, policies);
    }
}
