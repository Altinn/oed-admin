using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.DistrictCourts.GetDistrictCourts;

public static class Endpoint
{
    public static async Task<IResult> Get(
       [FromServices] OedDbContext dbContext)
    {
        var districtCourts = await dbContext
            .Estate
            .AsNoTracking()
            .Select(e => e.DistrictCourtName)
            .Where(dc => dc != null)
            .Distinct()
            .OrderBy(dc => dc)
            .ToListAsync();

        return TypedResults.Ok(new Response(districtCourts!));
    }
}
