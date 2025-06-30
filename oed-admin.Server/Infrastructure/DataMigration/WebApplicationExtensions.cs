using oed_admin.Server.Infrastructure.Authz;

namespace oed_admin.Server.Infrastructure.DataMigration;

public static class WebApplicationExtensions
{
    public static WebApplication MapDataMigrationEndpoints(this WebApplication app)
    {
        app.MapPost("/api/maintenance/datamigration", Handler)
            .RequireAuthorization(AuthorizationPolicies.DigitaltDodsboAdmins);

        return app;
    }

    private static Task Handler(HttpContext context)
    {
        throw new NotImplementedException();
    }
}