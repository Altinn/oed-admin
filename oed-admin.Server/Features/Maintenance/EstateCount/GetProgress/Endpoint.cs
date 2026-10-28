using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.EstateCount;

namespace oed_admin.Server.Features.Maintenance.EstateCount.GetProgress;

/// <remarks>
/// Audit: this stream returns matched estate ids and case numbers, but it is a GET without an
/// estateId route value, so AuditingLoggingMiddleware records no estates for it. That is a
/// deliberate product decision (spec 2026-10-28-estate-count-design.md, decision 10): the count
/// is treated as statistics, and only the filters - the StartCount request body - are audited.
/// </remarks>
public static class Endpoint
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(1);

    public static IResult Get(
        HttpContext httpContext,
        [FromServices] EstateCountState state,
        CancellationToken cancellationToken)
    {
        httpContext.Response.Headers.CacheControl = "no-store";
        // Belt and braces for reverse proxies that would otherwise buffer the stream.
        httpContext.Response.Headers["X-Accel-Buffering"] = "no";

        return TypedResults.ServerSentEvents(StreamSnapshots(state, cancellationToken));
    }

    /// <summary>
    /// The first snapshot on a connection carries every match and failure so far; later snapshots
    /// carry only what was appended since this connection's previous tick.
    /// </summary>
    private static async IAsyncEnumerable<EstateCountSnapshot> StreamSnapshots(
        EstateCountState state,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var sentMatches = 0;
        var sentFailures = 0;

        while (!cancellationToken.IsCancellationRequested)
        {
            var snapshot = state.GetSnapshot(sentMatches, sentFailures);
            sentMatches = snapshot.MatchCount;
            sentFailures = snapshot.FailureCount;

            yield return snapshot;

            // A finished or not-yet-started count has nothing more to say; the client reopens
            // the stream after starting a count.
            if (snapshot.Status != nameof(EstateCountStatus.Running))
                yield break;

            try
            {
                await Task.Delay(TickInterval, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                yield break;
            }
        }
    }
}
