using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Estate.Search
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

            var query = dbContext.Estate.AsNoTracking();

            var filteredQuery = request switch
            {
                { Nin: not null } =>
                    query.Where(e => e.DeceasedNin == request.Nin),
                { PartyId: not null } =>
                    query.Where(e => e.DeceasedPartyId == request.PartyId),
                { Name: not null } =>
                    query.Where(e => EF.Functions.Like(
                        e.DeceasedName.ToLower(),
                        $"%{request.Name.ToLower()}%")),
                _ => query
            };

            var estates = await filteredQuery
                .OrderByDescending(estate => estate.Created)
                .Skip(pageSize * (page - 1))
                .Take(pageSize)
                .ToListAsync();

            var dtos = estates
                .Select(PoorMansMapper.Map<Infrastructure.Database.Oed.Model.Estate, EstateDto>)
                .ToList();
            
            return TypedResults.Ok(new Response(page, pageSize, dtos!));
        }
    }
}
