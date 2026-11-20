using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.Runs.GetLatestVerifyRun;

/// <summary>
/// The latest finished verify run and its <c>ready</c> (status 404 in the body when none has finished). Shown next to
/// the phase, since <c>Database</c> needs it (Altinn/oed#1923 §4.3).
/// </summary>
public static class Endpoint
{
    public static async Task<IResult> Get(
        HttpContext httpContext,
        [FromServices] IOedSystemAdminClient client,
        CancellationToken cancellationToken)
    {
        httpContext.Response.Headers.CacheControl = "no-store";
        return TypedResults.Ok(RunResponse.From(await client.GetLatestVerifyRun(cancellationToken)));
    }
}
