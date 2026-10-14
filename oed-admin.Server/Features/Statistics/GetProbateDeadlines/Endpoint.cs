using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Statistics.GetProbateDeadlines;

public static class Endpoint
{
    /// <summary>CaseStatus of a case the district court registered in error ("feilført").</summary>
    private const string MispostedCaseStatus = "FEILFORT";

    private const int WeeksAhead = 12;

    /// <summary>
    /// Upper bounds, in days from now, of each bucket. A deadline belongs to the first bucket whose
    /// bound it is below; anything past the last bound is "later".
    /// </summary>
    private static readonly (string Bucket, double UpperDays)[] Buckets =
    [
        ("overdueMoreThan30", -30),
        ("overdue", 0),
        ("within7", 7),
        ("within30", 30),
        ("within90", 90),
    ];

    public static async Task<IResult> Get(
        [FromServices] OedDbContext dbContext,
        CancellationToken cancellationToken)
    {
        // An estate is open until the declaration is submitted or probate is issued, the same rule
        // as the backlog tab. Cancelled and misposted estates have no deadline to meet.
        var deadlines = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.IsCancelled == null || estate.IsCancelled == false)
            .Where(estate => estate.CaseStatus == null || estate.CaseStatus != MispostedCaseStatus)
            .Where(estate => estate.DeclarationSubmitted == null && estate.ProbateIssued == null)
            .Select(estate => estate.ProbateDeadline)
            .ToListAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;

        var bucketCounts = deadlines
            .GroupBy(deadline => BucketOf(deadline, now))
            .ToDictionary(group => group.Key, group => group.Count());

        var bucketOrder = Buckets.Select(bucket => bucket.Bucket).Append("later").Append("noDeadline");
        var buckets = bucketOrder
            .Select(bucket => new DeadlineBucketDto(bucket, bucketCounts.GetValueOrDefault(bucket)))
            .ToList();

        return TypedResults.Ok(new Response(buckets, Weeks(deadlines, now)));
    }

    private static string BucketOf(DateTimeOffset? deadline, DateTimeOffset now)
    {
        if (deadline is not { } value)
            return "noDeadline";

        var days = (value - now).TotalDays;
        foreach (var (bucket, upperDays) in Buckets)
        {
            if (days < upperDays)
                return bucket;
        }

        return "later";
    }

    private static List<DeadlineWeekDto> Weeks(List<DateTimeOffset?> deadlines, DateTimeOffset now)
    {
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        // ISO weeks start on Monday; DayOfWeek.Sunday is 0, so shift it to 6.
        var firstWeek = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));

        var perWeek = deadlines
            .OfType<DateTimeOffset>()
            .Where(deadline => deadline >= now)
            .Select(deadline => DateOnly.FromDateTime(deadline.UtcDateTime))
            .GroupBy(day => firstWeek.AddDays((day.DayNumber - firstWeek.DayNumber) / 7 * 7))
            .ToDictionary(group => group.Key, group => group.Count());

        return Enumerable.Range(0, WeeksAhead)
            .Select(week => firstWeek.AddDays(week * 7))
            .Select(weekStart => new DeadlineWeekDto(weekStart, perWeek.GetValueOrDefault(weekStart)))
            .ToList();
    }
}
