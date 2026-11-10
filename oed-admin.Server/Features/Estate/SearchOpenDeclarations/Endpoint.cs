using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Estate.SearchOpenDeclarations;

public static class Endpoint
{
    /// <summary>CaseStatus of a case the district court registered in error ("feilført").</summary>
    private const string MispostedCaseStatus = "FEILFORT";

    /// <summary>
    /// The estates behind the backlog count in Statistics.GetEstateBacklog: the filter here must
    /// stay in step with the one there. A POST with a body, because that is what makes the audit
    /// middleware extract the estate ids from the response.
    /// </summary>
    public static async Task<IResult> Post(
        [FromBody] Request request,
        [FromQuery] int pageSize,
        [FromQuery] int page,
        [FromServices] OedDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        if (page <= 0) page = 1;
        if (pageSize <= 0) pageSize = 10;

        var at = request.ToOrDefault;

        // Open at a moment: the declaration was created before it, and neither submitted nor
        // superseded by an issued probate before it. An estate that ended on or before its
        // declaration (bad data, never open) cannot pass, since its end would also be before the
        // moment.
        var estates = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.IsCancelled != true)
            .Where(estate => estate.CaseStatus != MispostedCaseStatus)
            .Where(estate => estate.DelarationCreated < at)
            .Where(estate => estate.DeclarationSubmitted == null || estate.DeclarationSubmitted >= at)
            .Where(estate => estate.ProbateIssued == null || estate.ProbateIssued >= at)
            // Longest open first; Id keeps the paging stable when two were created at the same time.
            .OrderBy(estate => estate.DelarationCreated)
            .ThenBy(estate => estate.Id)
            .Skip(pageSize * (page - 1))
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = estates
            .Select(PoorMansMapper.Map<Infrastructure.Database.Oed.Model.Estate, EstateDto>)
            .ToList();

        return TypedResults.Ok(new Response(page, pageSize, dtos!));
    }
}
