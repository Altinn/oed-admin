using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.SetPhase;

public record Request(string? Phase, string? Reason)
{
    public const int MaxReasonLength = 500;
    public static readonly string[] Phases = ["Storage", "Migrating", "Database"];

    // oed checks the same (400), but the person should not have to send a request to learn it.
    public bool IsValid() =>
        Phases.Contains(Phase, StringComparer.Ordinal)
        && !string.IsNullOrWhiteSpace(Reason)
        && Reason.Trim().Length <= MaxReasonLength;
}

/// <param name="Status">oed's HTTP status, or 0 when oed never answered.</param>
public record Response(int Status, OedModelPhaseState? Phase, OedAdminProblem? Problem);

/// <summary>
/// Changes the OED_M migration phase through oed (Altinn/oed#1923 §4.1). oed decides whether the change is allowed;
/// a 409's detail is its reason. Never retried.
/// </summary>
public static class Endpoint
{
    public static async Task<IResult> Put(
        [FromBody] Request request,
        HttpContext httpContext,
        [FromServices] IOedSystemAdminClient client,
        [FromServices] ILoggerFactory loggerFactory)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        httpContext.Response.Headers.CacheControl = "no-store";

        // oed records the token's client_id as changedBy, which is oed-admin, never the person. The reason is the only
        // place in oed's phase row that can say who asked.
        var user = SignedInUser.Of(httpContext);
        var reason = $"{request.Reason!.Trim()} (oed-admin: {user})";

        // Not the request's token: once oed has the call it may commit, and a closed tab must not skip the log line
        // below (§3). The HttpClient's own timeout (60 s) still bounds the wait.
        var result = await client.SetOedModelPhase(request.Phase!, reason, CancellationToken.None);

        loggerFactory.CreateLogger(typeof(Endpoint)).LogWarning(
            "OED_M phase change to {Phase} requested by {User}: oed answered {OedStatus}, stored phase {StoredPhase}, {ProblemDetail}. Reason sent: {Reason}",
            request.Phase,
            user,
            result.HttpStatus,
            result.Phase?.Phase ?? "(none)",
            result.Problem?.Detail ?? result.Problem?.Title ?? "(no problem)",
            reason);

        return TypedResults.Ok(new Response(result.HttpStatus, result.Phase, result.Problem));
    }
}
