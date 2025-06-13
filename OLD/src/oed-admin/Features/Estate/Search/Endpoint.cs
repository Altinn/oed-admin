using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using oed_admin.Infrastructure.Database.Oed;
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


            var query = dbContext.Estate
                .OrderByDescending(estate => estate.Created)
                .Skip(pageSize * (page - 1))
                .Take(pageSize)
                .AsNoTracking();

            var filteredQuery = request switch
            {
                { Nin: not null } => query.Where(e => e.DeceasedNin == request.Nin),
                { PartyId: not null } => query.Where(e => e.DeceasedPartyId == request.PartyId),
                { Name: not null } => query.Where(e => 
                    EF.Functions.Like(
                        e.DeceasedName.ToLower(),
                        $"%{request.Name.ToLower()}%")),
                _ => query
            };
            
            var estates = await filteredQuery.ToListAsync();

            var dtos = estates
                .Select(PoorMansMapper.Map<Infrastructure.Database.Oed.Model.Estate, EstateDto>)
                .ToList();
            
            return TypedResults.Ok(new Response(page, pageSize, dtos!));
        }
    }
}
