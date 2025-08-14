using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Estate.GetProbateInformation;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IOedClient oedClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estate = await dbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);

        if (estate is null)
            return TypedResults.BadRequest();

        if (estate.DeclarationInstanceId is null or {Length: 0})
            return TypedResults.Ok(new Response(null));

        var parts = estate.DeclarationInstanceId.Split("/");

        if (parts is null or {Length: not 2})
            return TypedResults.Ok(new Response(null));

        if (!int.TryParse(parts[0], out var instanceOwnerPartyId))
            return TypedResults.Ok(new Response(null));

        if (!Guid.TryParse(parts[1], out var instanceGuid))
            return TypedResults.Ok(new Response(null));

        var probateInformation = await oedClient.GetOedProbateInformation(instanceOwnerPartyId, instanceGuid);
        
        return TypedResults.Ok(new Response(probateInformation));
    }
}