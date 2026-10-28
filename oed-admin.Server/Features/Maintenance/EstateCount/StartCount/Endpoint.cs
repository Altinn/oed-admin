using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Auditing;
using oed_admin.Server.Infrastructure.EstateCount;

namespace oed_admin.Server.Features.Maintenance.EstateCount.StartCount;

/// <param name="CaseStatuses">Empty or null means no filter. "NONE" selects estates without a case status.</param>
/// <param name="GroupByHeirRoles">Group by heir role. Reads every selected estate from Storage; off, no Storage lookups.</param>
public record Request(
    DateOnly? CreatedFrom,
    DateOnly? CreatedTo,
    List<string>? CaseStatuses,
    bool GroupByHeirRoles)
{
    // The year bounds keep the Oslo-midnight conversion away from DateTimeOffset's limits.
    public bool IsValid() =>
        CreatedFrom is { Year: >= 2000 } from &&
        CreatedTo is { Year: <= 9998 } to &&
        from <= to &&
        (CaseStatuses ?? []).TrueForAll(EstateCountOptions.IsValidCaseStatus);

    public EstateCountFilters ToFilters() => new(
        CreatedFrom ?? throw new InvalidOperationException("Call IsValid() before ToFilters()."),
        CreatedTo ?? throw new InvalidOperationException("Call IsValid() before ToFilters()."),
        (CaseStatuses ?? []).Distinct().ToList(),
        GroupByHeirRoles);
}

public record Response(string Status);

public static class Endpoint
{
    public static IResult Post(
        [FromBody] Request request,
        HttpContext httpContext,
        [FromServices] EstateCountState state,
        [FromServices] Channel<EstateCountTrigger> channel)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var trigger = new EstateCountTrigger(
            DateTimeOffset.UtcNow,
            request.ToFilters(),
            httpContext.User.GetName());

        // The state guard, not the channel, is what prevents two overlapping counts. Marking the
        // run active before responding means a client that connects to the progress stream
        // immediately sees Running rather than Idle.
        if (!state.TryBeginRun(trigger))
            return TypedResults.Conflict();

        if (!channel.Writer.TryWrite(trigger))
        {
            state.EndRun(EstateCountStatus.Faulted, "Could not enqueue the estate count trigger.");
            return TypedResults.Conflict();
        }

        // A JSON body, not an empty one: AuditingLoggingMiddleware buffers and parses the
        // response of any POST that has a request body. The request body - the filters - is
        // what the audit log records for a count; see GetProgress for why that is all.
        return TypedResults.Accepted(string.Empty, new Response("Started"));
    }
}
