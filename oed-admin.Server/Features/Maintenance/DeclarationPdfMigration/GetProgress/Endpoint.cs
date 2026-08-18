using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.DeclarationPdfMigration;

namespace oed_admin.Server.Features.Maintenance.DeclarationPdfMigration.GetProgress;

public static class Endpoint
{
    private static readonly TimeSpan TickInterval = TimeSpan.FromSeconds(1);

    public static IResult Get(
        HttpContext httpContext,
        [FromServices] DeclarationPdfMigrationState state,
        CancellationToken cancellationToken)
    {
        httpContext.Response.Headers.CacheControl = "no-store";
        // Belt and braces for reverse proxies that would otherwise buffer the stream.
        httpContext.Response.Headers["X-Accel-Buffering"] = "no";

        return TypedResults.ServerSentEvents(StreamSnapshots(state, cancellationToken));
    }

    /// <summary>
    /// The first snapshot on a connection carries every failure so far; later snapshots carry
    /// only what was appended since this connection's previous tick, because the failure list
    /// is uncapped and re-sending it every second would be megabytes on a bad run.
    /// </summary>
    private static async IAsyncEnumerable<ProgressSnapshot> StreamSnapshots(
        DeclarationPdfMigrationState state,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var sentFailures = 0;

        while (!cancellationToken.IsCancellationRequested)
        {
            var snapshot = state.GetSnapshot(sentFailures);
            sentFailures = snapshot.FailureCount;

            yield return snapshot;

            // A finished or not-yet-started run has nothing more to say; the client reopens
            // the stream after starting a run.
            if (snapshot.Status != nameof(RunStatus.Running))
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
