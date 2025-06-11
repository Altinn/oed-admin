using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Infrastructure.Database;
using oed_admin.Infrastructure.Mapping;

namespace oed_admin.Features.Estate.Search
{
    public static class Endpoint
    {
        public static async Task<IResult> Post(
            [FromBody] Request request,
            [FromServices] OedDbContext dbContext)
        {
            if (!request.IsValid())
                return TypedResults.BadRequest();

            var page = request.Page ?? 1;
            var pageSize = request.PageSize ?? 10;

            var estates = await dbContext.Estate
                .OrderByDescending(estate => estate.Created)
                .Skip(pageSize * (page - 1))
                .Take(pageSize)
                .AsNoTracking()
                .ToListAsync();

            var dtos = estates
                .Select(PoorMansMapper.Map<Infrastructure.Database.Model.Estate, EstateDto>)
                .ToList();
            
            return TypedResults.Ok(new Response(page, pageSize, dtos!));
        }
    }
}
