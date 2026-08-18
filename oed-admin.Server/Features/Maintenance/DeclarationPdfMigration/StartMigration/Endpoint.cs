using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.DeclarationPdfMigration;

namespace oed_admin.Server.Features.Maintenance.DeclarationPdfMigration.StartMigration;

/// <param name="Limit">Maximum number of estates to process, or null for all of them.</param>
public record Request(int? Limit, bool Overwrite, bool DryRun)
{
    public bool IsValid() => Limit is null or > 0;
}

public record Response(string Status);

public static class Endpoint
{
    public static IResult Post(
        [FromBody] Request request,
        [FromServices] DeclarationPdfMigrationState state,
        [FromServices] Channel<DeclarationPdfMigrationTrigger> channel)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var trigger = new DeclarationPdfMigrationTrigger(
            DateTimeOffset.UtcNow,
            request.Limit,
            request.Overwrite,
            request.DryRun);

        // The state guard, not the channel, is what prevents two overlapping runs. Marking the
        // run active before responding means a client that connects to the progress stream
        // immediately sees Running rather than Idle.
        if (!state.TryBeginRun(trigger))
            return TypedResults.Conflict();

        if (!channel.Writer.TryWrite(trigger))
        {
            state.EndRun(RunStatus.Faulted, "Could not enqueue the migration trigger.");
            return TypedResults.Conflict();
        }

        // A JSON body, not an empty one: AuditingLoggingMiddleware buffers and parses the
        // response of any POST that has a request body.
        return TypedResults.Accepted(string.Empty, new Response("Started"));
    }
}
