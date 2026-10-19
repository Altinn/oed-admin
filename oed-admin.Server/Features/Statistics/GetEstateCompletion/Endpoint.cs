using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Statistics.GetEstateCompletion;

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

        var from = request.FromOrDefault;
        var to = request.ToOrDefault;

        // The cohorts need the estates opened in the period; the monthly event counts also need the
        // estates that submitted or got probate in it, whenever they were opened. One query fetches
        // both and the split happens in memory.
        var estates = await dbContext.Estate
            .AsNoTracking()
            .Where(estate =>
                (estate.Created >= from && estate.Created < to) ||
                (estate.DeclarationSubmitted >= from && estate.DeclarationSubmitted < to) ||
                (estate.ProbateIssued >= from && estate.ProbateIssued < to))
            // An estate that was cancelled, or that the court registered in error, can never reach
            // probate. It belongs in neither the numerator nor the denominator, otherwise the rate
            // measures court data quality rather than how many estates get settled.
            //
            // Both columns are nullable and the null branches are spelled out on purpose: in SQL's
            // three-valued logic a bare "CaseStatus <> 'FEILFORT'" drops every row where CaseStatus
            // is NULL, which is most of them. EF Core compensates today; writing it explicitly means
            // the intent survives someone rewriting this as raw SQL.
            .Where(estate => estate.IsCancelled == null || estate.IsCancelled == false)
            .Where(estate => estate.CaseStatus == null || estate.CaseStatus != MispostedCaseStatus)
            .Select(estate => new
            {
                estate.Created,
                estate.DeclarationSubmitted,
                estate.ProbateIssued,
                HasDeclarationSubmitted = estate.DeclarationSubmitted != null,
                HasProbateIssued = estate.ProbateIssued != null
            })
            .ToListAsync(cancellationToken);

        var opened = CountPerMonth(estates.Select(estate => (DateTimeOffset?)estate.Created), from, to);
        var submitted = CountPerMonth(estates.Select(estate => estate.DeclarationSubmitted), from, to);
        var issued = CountPerMonth(estates.Select(estate => estate.ProbateIssued), from, to);

        var monthlyEvents = MonthsBetween(from, to)
            .Select(month => new MonthEventsDto(
                month,
                opened.GetValueOrDefault(month),
                submitted.GetValueOrDefault(month),
                issued.GetValueOrDefault(month)))
            .ToList();

        // Bucketing happens here rather than in a GROUP BY because Created is a timestamptz, and
        // date_part on a timestamptz resolves against the session TimeZone -- so the same estate can
        // land either side of a month boundary depending on how the connection happens to be
        // configured. Grouping on the UTC value in memory makes the buckets deterministic. The
        // filtered set is small (the service opens on the order of 50 estates a day), so the cost is
        // a few tens of thousands of narrow rows; push this back into SQL if that ever stops
        // being true.
        var cohorts = estates
            .Where(estate => estate.Created >= from && estate.Created < to)
            .GroupBy(estate => new
            {
                estate.Created.UtcDateTime.Year,
                estate.Created.UtcDateTime.Month
            })
            .OrderBy(group => group.Key.Year)
            .ThenBy(group => group.Key.Month)
            .Select(group =>
            {
                var opened = group.Count();
                var declarationSubmitted = group.Count(estate => estate.HasDeclarationSubmitted);
                var probateIssued = group.Count(estate => estate.HasProbateIssued);

                return new CohortDto(
                    $"{group.Key.Year:D4}-{group.Key.Month:D2}",
                    opened,
                    declarationSubmitted,
                    probateIssued,
                    Percentage(declarationSubmitted, opened),
                    Percentage(probateIssued, opened));
            })
            .ToList();

        return TypedResults.Ok(new Response(cohorts, monthlyEvents));
    }

    private static Dictionary<string, int> CountPerMonth(
        IEnumerable<DateTimeOffset?> timestamps, DateTimeOffset from, DateTimeOffset to) =>
        timestamps
            .OfType<DateTimeOffset>()
            .Where(timestamp => timestamp >= from && timestamp < to)
            .CountBy(MonthOf)
            .ToDictionary();

    private static string MonthOf(DateTimeOffset timestamp) =>
        $"{timestamp.UtcDateTime.Year:D4}-{timestamp.UtcDateTime.Month:D2}";

    /// <summary>Every UTC month the period touches, oldest first, so months without events still appear.</summary>
    private static IEnumerable<string> MonthsBetween(DateTimeOffset from, DateTimeOffset to)
    {
        var month = new DateTime(from.UtcDateTime.Year, from.UtcDateTime.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        for (; month < to.UtcDateTime; month = month.AddMonths(1))
            yield return $"{month.Year:D4}-{month.Month:D2}";
    }

    private static decimal Percentage(int part, int whole) =>
        whole == 0 ? 0m : Math.Round(100m * part / whole, 1);
}
