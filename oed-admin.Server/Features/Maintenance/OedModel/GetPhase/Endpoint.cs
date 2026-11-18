using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.GetPhase;

/// <param name="Status">oed's HTTP status, or 0 when oed never answered.</param>
public record Response(int Status, OedModelPhaseState? Phase, OedAdminProblem? Problem);

/// <summary>The stored OED_M migration phase, as oed reports it (Altinn/oed#1923 §4.1).</summary>
public static class Endpoint
{
    public static async Task<IResult> Get(
        HttpContext httpContext,
        [FromServices] IOedSystemAdminClient client,
        CancellationToken cancellationToken)
    {
        httpContext.Response.Headers.CacheControl = "no-store";
        var result = await client.GetOedModelPhase(cancellationToken);
        // 200 whatever oed said: oed's status is in the body, so a 403 from oed (oed-admin's token) can't be mistaken
        // for the signed-in user lacking a role, nor a 502 from oed for the dev proxy failing.
        return TypedResults.Ok(new Response(result.HttpStatus, result.Phase, result.Problem));
    }
}
