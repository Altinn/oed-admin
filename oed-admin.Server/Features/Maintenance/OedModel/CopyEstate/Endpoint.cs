using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.CopyEstate;

public record Request(int PartyId, Guid InstanceGuid)
{
    public bool IsValid() => PartyId > 0 && InstanceGuid != Guid.Empty;
}

/// <param name="Status">oed's HTTP status, or 0 when oed never answered.</param>
/// <param name="RetryAfterSeconds">With a 503: when the person may ask to try again.</param>
public record Response(int Status, OedModelCopy? Copy, OedAdminProblem? Problem, int? RetryAfterSeconds);

/// <summary>
/// Copies one estate's OED_M to oed's database through oed (Altinn/oed#1923 §4.2). One estate per request, never
/// retried here: a 503 is handed back with its Retry-After, and only the person may ask again. Bulk is #1902's sweep.
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

        // Not the request's token: once oed has the call it may commit, and a closed tab must not skip the log line
        // below (§3). The HttpClient's own timeout (60 s) still bounds the wait.
        var result = await client.CopyOedModel(request.PartyId, request.InstanceGuid, CancellationToken.None);

        loggerFactory.CreateLogger(typeof(Endpoint)).LogWarning(
            "OED_M copy of instance {PartyId}/{InstanceGuid} requested by {User}: oed answered {OedStatus}, outcome {Outcome}, failure {Failure}, {ProblemDetail}",
            request.PartyId,
            request.InstanceGuid,
            SignedInUser.Of(httpContext),
            result.HttpStatus,
            result.Copy?.Outcome ?? "(none)",
            result.Copy?.Failure ?? "(none)",
            result.Problem?.Detail ?? result.Problem?.Title ?? "(no problem)");

        // 200 whatever oed said, with oed's status in the body; see GetPhase.
        return TypedResults.Ok(new Response(result.HttpStatus, result.Copy, result.Problem, result.RetryAfterSeconds));
    }
}
