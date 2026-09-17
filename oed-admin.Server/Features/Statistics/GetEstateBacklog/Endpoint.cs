using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Statistics.GetEstateBacklog;

public static class Endpoint
{
    /// <summary>CaseStatus of a case the district court registered in error ("feilført").</summary>
    private const string MispostedCaseStatus = "FEILFORT";

    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        // No filter on From/To: an estate declared before the range can still be ongoing inside
        // it, so the running total needs the whole history.
        var estates = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.DelarationCreated != null)
            // Cancelled and mis-posted estates never reach probate and would sit in the backlog
            // forever. Neither flag is timestamped, so they are dropped from all of history. The
            // null branches are spelled out for the same reason as in GetEstateCompletion: a bare
            // <> in SQL drops NULL rows.
            .Where(estate => estate.IsCancelled == null || estate.IsCancelled == false)
            .Where(estate => estate.CaseStatus == null || estate.CaseStatus != MispostedCaseStatus)
            .Select(estate => new { estate.DelarationCreated, estate.ProbateIssued })
            .ToListAsync(cancellationToken);

        var events = new List<(DateTimeOffset At, int Delta)>(estates.Count * 2);
        foreach (var estate in estates)
        {
            var declared = estate.DelarationCreated!.Value;

            // Probate on or before the declaration is bad data; such an estate is never ongoing.
            if (estate.ProbateIssued is { } probate && probate <= declared)
                continue;

            events.Add((declared, +1));
            if (estate.ProbateIssued is { } issued)
                events.Add((issued, -1));
        }

        if (request.From is null && events.Count == 0)
            return TypedResults.Ok(new Response([]));

        events.Sort((a, b) => a.At.CompareTo(b.At));

        var resolution = request.ResolutionOrDefault;
        var to = request.ToOrDefault;
        // Bad-data declarations from before the floor are folded into the first point.
        var from = request.From ?? (events[0].At < Request.EarliestFrom ? Request.EarliestFrom : events[0].At);

        return TypedResults.Ok(new Response(Sweep(events, from, to, resolution)));
    }

    /// <summary>
    /// Walks the sorted events once, recording the running total at the end of each UTC period.
    /// An event counts towards a period when it happened strictly before the period's end; the
    /// last period ends at <paramref name="to"/> instead of at the next period start.
    /// </summary>
    private static List<BacklogPointDto> Sweep(
        List<(DateTimeOffset At, int Delta)> events,
        DateTimeOffset from,
        DateTimeOffset to,
        BacklogResolution resolution)
    {
        var points = new List<BacklogPointDto>();
        var total = 0;
        var index = 0;

        for (var periodStart = FloorToPeriod(from, resolution); periodStart < to;)
        {
            var nextStart = NextPeriod(periodStart, resolution);
            var evaluatedAt = nextStart < to ? nextStart : to;

            while (index < events.Count && events[index].At < evaluatedAt)
            {
                total += events[index].Delta;
                index++;
            }

            points.Add(new BacklogPointDto(DateOnly.FromDateTime(periodStart.UtcDateTime), total));
            periodStart = nextStart;
        }

        return points;
    }

    private static DateTimeOffset FloorToPeriod(DateTimeOffset value, BacklogResolution resolution)
    {
        var utc = value.ToUniversalTime();
        var day = new DateTimeOffset(utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero);

        return resolution switch
        {
            BacklogResolution.Day => day,
            // ISO weeks start on Monday; DayOfWeek.Sunday is 0, so shift it to 6.
            BacklogResolution.Week => day.AddDays(-(((int)day.DayOfWeek + 6) % 7)),
            BacklogResolution.Month => new DateTimeOffset(utc.Year, utc.Month, 1, 0, 0, 0, TimeSpan.Zero),
            _ => throw new ArgumentOutOfRangeException(nameof(resolution), resolution, null)
        };
    }

    private static DateTimeOffset NextPeriod(DateTimeOffset periodStart, BacklogResolution resolution) =>
        resolution switch
        {
            BacklogResolution.Day => periodStart.AddDays(1),
            BacklogResolution.Week => periodStart.AddDays(7),
            BacklogResolution.Month => periodStart.AddMonths(1),
            _ => throw new ArgumentOutOfRangeException(nameof(resolution), resolution, null)
        };
}
