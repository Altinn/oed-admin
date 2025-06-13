using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Estate.GetEstate;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estate = await dbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);

        if (estate is null)
            return TypedResults.Ok(new Response(null));

        var dto = PoorMansMapper.Map<Infrastructure.Database.Oed.Model.Estate, EstateDto>(estate);
        return TypedResults.Ok(new Response(dto));
    }
}