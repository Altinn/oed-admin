using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Statistics.GetEstateLeadTimes;

public static class Endpoint
{
    /// <summary>CaseStatus of a case the district court registered in error ("feilført").</summary>
    private const string MispostedCaseStatus = "FEILFORT";

    private sealed record Row(
        DateTimeOffset Created,
        DateOnly DateOfDeath,
        DateTimeOffset? FirstHeirReceived,
        DateTimeOffset? DeclarationCreated,
        DateTimeOffset? DeclarationSubmitted,
        DateTimeOffset? ProbateIssued);

    /// <summary>
    /// The durations reported, in display order. Each returns null when the estate has not reached
    /// both ends yet.
    /// </summary>
    private static readonly (string Measure, Func<Row, double?> Days)[] Measures =
    [
        // DateOfDeath is not nullable; an unset one comes back as 0001-01-01 and is not a duration.
        ("deathToCreated", row => row.DateOfDeath == default
            ? null
            : row.Created.UtcDateTime.Date.Subtract(row.DateOfDeath.ToDateTime(TimeOnly.MinValue)).TotalDays),
        ("createdToFirstHeir", row => Between(row.Created, row.FirstHeirReceived)),
        ("declarationDuration", row => Between(row.DeclarationCreated, row.DeclarationSubmitted)),
        ("createdToDeclarationSubmitted", row => Between(row.Created, row.DeclarationSubmitted)),
        ("createdToProbate", row => Between(row.Created, row.ProbateIssued)),
    ];

    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var from = request.FromOrDefault;
        var to = request.ToOrDefault;

        // Cancelled and misposted estates never run their course, so their durations say nothing
        // about how long settlement takes. Null branches spelled out as in GetEstateCompletion.
        var rows = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.Created >= from && estate.Created < to)
            .Where(estate => estate.IsCancelled == null || estate.IsCancelled == false)
            .Where(estate => estate.CaseStatus == null || estate.CaseStatus != MispostedCaseStatus)
            .Select(estate => new Row(
                estate.Created,
                estate.DateOfDeath,
                estate.FirstHeirReceived,
                estate.DelarationCreated,
                estate.DeclarationSubmitted,
                estate.ProbateIssued))
            .ToListAsync(cancellationToken);

        // Bucketed on the UTC value in memory, as in GetEstateCompletion.
        var months = rows
            .GroupBy(row => $"{row.Created.UtcDateTime.Year:D4}-{row.Created.UtcDateTime.Month:D2}")
            .OrderBy(group => group.Key)
            .Select(group => new LeadTimeMonthDto(group.Key, group.Count(), Summarize(group.ToList())))
            .ToList();

        return TypedResults.Ok(new Response(Summarize(rows), months));
    }

    private static List<LeadTimeDto> Summarize(IReadOnlyCollection<Row> rows) =>
        Measures
            .Select(measure =>
            {
                var days = rows
                    .Select(measure.Days)
                    .OfType<double>()
                    .Where(value => value >= 0)
                    .ToList();

                return new LeadTimeDto(measure.Measure, days.Count, Percentile.Of(days, 0.5), Percentile.Of(days, 0.75));
            })
            .ToList();

    private static double? Between(DateTimeOffset? start, DateTimeOffset? end) =>
        start is { } s && end is { } e ? (e - s).TotalDays : null;
}
