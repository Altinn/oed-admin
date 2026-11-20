using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.Runs.StartRun;

/// <param name="Mode"><c>sweep</c> or <c>verify</c>.</param>
/// <remarks>The same limits as oed's, so the person learns them without a request. Null leaves oed's default.</remarks>
public record Request(string? Mode, int? Limit, double? RatePerSecond, int? MaxParallelism, int? SampleSize)
{
    public bool IsValid() =>
        Mode is "sweep" or "verify"
        && (Limit is null || (Mode == "sweep" && Limit >= 1))
        && (RatePerSecond is null || RatePerSecond is > 0 and <= 10)
        && (MaxParallelism is null || MaxParallelism is >= 1 and <= 10)
        && (SampleSize is null || (Mode == "verify" && SampleSize is >= 0 and <= 10000));
}

/// <summary>
/// Queues a sweep or verify run in oed (Altinn/oed#1923 §4.3). oed decides whether it may start: a 409 names the
/// active run, or says the block flag is off. A sweep copies estates, so rule 5 applies from its first copy. Never
/// retried.
/// </summary>
public static class Endpoint
{
    public static async Task<IResult> Post(
        [FromBody] Request request,
        HttpContext httpContext,
        [FromServices] IOedSystemAdminClient client,
        [FromServices] ILoggerFactory loggerFactory)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        httpContext.Response.Headers.CacheControl = "no-store";

        // Not the request's token: once oed has queued the run, a closed tab must not skip the log line. oed records
        // only oed-admin's client as requestedBy, so this line and the audit log are where the person is.
        var result = await client.StartMigrationRun(
            new OedModelMigrationRunStart(request.Mode!, request.Limit, request.RatePerSecond, request.MaxParallelism, request.SampleSize),
            CancellationToken.None);

        loggerFactory.CreateLogger(typeof(Endpoint)).LogWarning(
            "OED_M {Mode} run requested by {User} (limit {Limit}, rate {RatePerSecond}, parallelism {MaxParallelism}, sample {SampleSize}): oed answered {OedStatus}, run {RunId}, {ProblemDetail}",
            request.Mode,
            SignedInUser.Of(httpContext),
            request.Limit?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "(none)",
            request.RatePerSecond?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "(default)",
            request.MaxParallelism?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "(default)",
            request.SampleSize?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "(default)",
            result.HttpStatus,
            result.Run?.Id.ToString() ?? result.ActiveRunId?.ToString() ?? "(none)",
            result.Problem?.Detail ?? result.Problem?.Title ?? "(no problem)");

        return TypedResults.Ok(RunResponse.From(result));
    }
}
