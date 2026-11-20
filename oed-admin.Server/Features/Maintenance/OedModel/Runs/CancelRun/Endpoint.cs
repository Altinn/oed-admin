using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.Runs.CancelRun;

public record Request(Guid RunId)
{
    public bool IsValid() => RunId != Guid.Empty;
}

/// <summary>
/// Asks oed to cancel a queued or running run (Altinn/oed#1923 §4.3). Estates already being copied finish; the run
/// then ends Cancelled with a report. 409 when it has already ended. Never retried.
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

        // Not the request's token, as for start.
        var result = await client.CancelMigrationRun(request.RunId, CancellationToken.None);

        loggerFactory.CreateLogger(typeof(Endpoint)).LogWarning(
            "OED_M run {RunId} cancel requested by {User}: oed answered {OedStatus}, status {RunStatus}, {ProblemDetail}",
            request.RunId,
            SignedInUser.Of(httpContext),
            result.HttpStatus,
            result.Run?.Status ?? "(none)",
            result.Problem?.Detail ?? result.Problem?.Title ?? "(no problem)");

        return TypedResults.Ok(RunResponse.From(result));
    }
}
