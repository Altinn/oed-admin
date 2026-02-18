using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;

namespace oed_admin.Server.Features.DistrictCourts.GetDistrictCourts;

public static class Endpoint
{
    public static async Task<IResult> Get(
       [FromServices] OedDbContext dbContext,
       [FromServices] IHttpContextAccessor httpContextAccessor)
    {
        var httpContext = httpContextAccessor.HttpContext!;
        var currentUser = httpContext.User;
        var isAdmin = currentUser.IsInRole("Admin");
        IQueryable<DistrictCourtSummaryDto> query;
        var estateQuery = dbContext
            .Estate
            .AsNoTracking()
            .Where(e => e.DistrictCourtName != null)
            .GroupBy(e => e.DistrictCourtName)
            .OrderBy(g => g.Key);

        if (isAdmin)
        {
            query = estateQuery
                .Select(g => new DistrictCourtSummaryDto(
                    g.Key!,
                    g.Count()
                ));
        }
        else
        {
            query = estateQuery
                .Select(g => new DistrictCourtSummaryDto(
                    g.Key!,
                    null
                ));
        }

        var districtCourtGroups = await query
            .ToListAsync();

        return TypedResults.Ok(new Response(districtCourtGroups!));
    }
}
