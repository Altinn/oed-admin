using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.Runs.GetActiveRun;

/// <summary>
/// The queued or running run, if any (status 404 in the body when none). After a pod dies, oed continues an
/// abandoned run under a new id that only this reveals (Altinn/oed#1923 §4.3).
/// </summary>
public static class Endpoint
{
    public static async Task<IResult> Get(
        HttpContext httpContext,
        [FromServices] IOedSystemAdminClient client,
        CancellationToken cancellationToken)
    {
        httpContext.Response.Headers.CacheControl = "no-store";
        return TypedResults.Ok(RunResponse.From(await client.GetActiveMigrationRun(cancellationToken)));
    }
}
