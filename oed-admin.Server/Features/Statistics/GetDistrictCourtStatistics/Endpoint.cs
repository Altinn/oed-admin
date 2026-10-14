using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Statistics.GetDistrictCourtStatistics;

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

        // Cancelled and misposted estates excluded, as in GetEstateCompletion. Null branches
        // spelled out for the same reason.
        var estates = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.Created >= from && estate.Created < to)
            .Where(estate => estate.IsCancelled == null || estate.IsCancelled == false)
            .Where(estate => estate.CaseStatus == null || estate.CaseStatus != MispostedCaseStatus)
            .Select(estate => new
            {
                estate.DistrictCourtName,
                estate.Created,
                estate.DelarationCreated,
                estate.DeclarationSubmitted,
                estate.ProbateIssued
            })
            .ToListAsync(cancellationToken);

        var courts = estates
            .GroupBy(estate => string.IsNullOrWhiteSpace(estate.DistrictCourtName) ? null : estate.DistrictCourtName)
            .Select(court =>
            {
                var count = court.Count();
                var open = court.Count(estate =>
                    estate.DelarationCreated != null && estate.DeclarationSubmitted == null && estate.ProbateIssued == null);
                var daysToProbate = court
                    .Where(estate => estate.ProbateIssued != null)
                    .Select(estate => (estate.ProbateIssued!.Value - estate.Created).TotalDays)
                    .Where(days => days >= 0)
                    .ToList();
                var probated = court.Count(estate => estate.ProbateIssued != null);

                return new DistrictCourtStatisticsDto(
                    court.Key,
                    count,
                    open,
                    probated,
                    count == 0 ? 0m : Math.Round(100m * probated / count, 1),
                    Percentile.Of(daysToProbate, 0.5));
            })
            .OrderByDescending(court => court.Estates)
            .ToList();

        return TypedResults.Ok(new Response(courts));
    }
}
