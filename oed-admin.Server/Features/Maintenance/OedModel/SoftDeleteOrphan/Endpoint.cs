using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.SoftDeleteOrphan;

public record Request(int PartyId, Guid InstanceGuid)
{
    public bool IsValid() => PartyId > 0 && InstanceGuid != Guid.Empty;
}

/// <param name="Status">oed's HTTP status, or 0 when oed never answered.</param>
/// <param name="RetryAfterSeconds">With a 503: when the person may ask to try again.</param>
public record Response(int Status, OedModelOrphanSoftDelete? Result, OedAdminProblem? Problem, int? RetryAfterSeconds);

/// <summary>
/// Asks oed to soft-delete one instance the OED_M migration can never copy (Altinn/oed#1905). oed checks that it is an
/// orphan and refuses outside TT02; this endpoint only passes the answer on. One estate per request, never retried
/// here: the page's bulk action calls it once per estate, one at a time.
/// </summary>
public static class Endpoint
{
    public static async Task<IResult> Post(
        [AsParameters] Request request,
        HttpContext httpContext,
        [FromServices] IOedSystemAdminClient client,
        [FromServices] ILoggerFactory loggerFactory)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        httpContext.Response.Headers.CacheControl = "no-store";

        // Not the request's token: once oed has the call it may delete, and a closed tab must not skip the log line.
        var result = await client.SoftDeleteOedModelOrphan(request.PartyId, request.InstanceGuid, CancellationToken.None);

        loggerFactory.CreateLogger(typeof(Endpoint)).LogWarning(
            "OED_M orphan soft delete of instance {PartyId}/{InstanceGuid} requested by {User}: oed answered {OedStatus}, outcome {Outcome}, reason {Reason}, {ProblemDetail}",
            request.PartyId,
            request.InstanceGuid,
            SignedInUser.Of(httpContext),
            result.HttpStatus,
            result.Result?.Outcome ?? "(none)",
            result.Result?.Reason ?? "(none)",
            result.Problem?.Detail ?? result.Problem?.Title ?? "(no problem)");

        // 200 whatever oed said, with oed's status in the body; see GetPhase.
        return TypedResults.Ok(new Response(result.HttpStatus, result.Result, result.Problem, result.RetryAfterSeconds));
    }
}
