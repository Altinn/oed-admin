using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Estate.Search;

public static class Endpoint
{
    public static async Task<IResult> Post(
        [FromBody] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] AuthzDbContext authzDbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var page = request.Page ?? 1;
        var pageSize = request.PageSize ?? 10;

        var query = dbContext.Estate.AsNoTracking();

        var estateNinList = new List<string>();
            
        if (request.HeirNin is { Length: > 0})
        {
            estateNinList = await GetEstateByHeirNin(request.HeirNin, authzDbContext);

            if (estateNinList is null or { Count: 0 })
            {
                return TypedResults.Ok(new Response(page, pageSize, []));
            }
        }

        var filteredQuery = request switch
        {
            { Nin.Length: 11 } =>
                query.Where(e => e.DeceasedNin == request.Nin),
            { Nin.Length: 6 } =>
                query.Where(e =>
                    EF.Functions.Like(
                        e.DeceasedNin,
                        $"{request.Nin}%")),
            { PartyId: not null } =>
                query.Where(e => e.DeceasedPartyId == request.PartyId),
            { Name: not null } =>
                query.Where(e =>
                    EF.Functions.Like(
                        e.DeceasedName.ToLower(),
                        $"%{request.Name.ToLower()}%")),
            { CaseNumber: not null } =>
                query.Where(e =>
                    e.CaseNumber != null &&
                    e.CaseNumber.ToLower() == request.CaseNumber.ToLower()),
            _ => query
        };

        if (estateNinList.Count > 0)
        {
            filteredQuery = filteredQuery.Where(e => estateNinList.Contains( e.DeceasedNin));
        }

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

    private static async Task<List<string>> GetEstateByHeirNin(
        string heirNin, 
        AuthzDbContext authzDbContext)
    {
        var query = authzDbContext.RoleAssignments.AsNoTracking();
        var filteredQuery = heirNin switch
        {
            { Length: 11 } nin => 
                query.Where(e => e.RecipientSsn == nin),
            { Length: 6 } nin =>
                query.Where(e =>
                    EF.Functions.Like(
                        e.RecipientSsn,
                        $"{nin}%")),
            _ => query
        };

        var estateSsns = await filteredQuery
            .Select(x => x.EstateSsn)
            .ToListAsync();

        return estateSsns;
    }
}