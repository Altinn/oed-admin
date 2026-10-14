using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Statistics.GetEstateOutcomes;

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

        // No cancelled/misposted filter: those are two of the outcomes being counted.
        var estates = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.Created >= from && estate.Created < to)
            .Select(estate => new { estate.Created, estate.IsCancelled, estate.CaseStatus, estate.ProbateResult })
            .ToListAsync(cancellationToken);

        // Bucketed on the UTC value in memory, as in GetEstateCompletion.
        var months = estates
            .GroupBy(estate => $"{estate.Created.UtcDateTime.Year:D4}-{estate.Created.UtcDateTime.Month:D2}")
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                var cancelled = group.Count(estate => estate.IsCancelled == true);
                var misposted = group.Count(estate => estate.IsCancelled != true && estate.CaseStatus == MispostedCaseStatus);
                var results = group
                    .Where(estate => estate.IsCancelled != true && estate.CaseStatus != MispostedCaseStatus)
                    .GroupBy(estate => string.IsNullOrWhiteSpace(estate.ProbateResult) ? null : estate.ProbateResult)
                    .OrderByDescending(result => result.Count())
                    .Select(result => new ProbateResultCountDto(result.Key, result.Count()))
                    .ToList();

                return new OutcomeMonthDto(group.Key, group.Count(), cancelled, misposted, results);
            })
            .ToList();

        return TypedResults.Ok(new Response(months));
    }
}
