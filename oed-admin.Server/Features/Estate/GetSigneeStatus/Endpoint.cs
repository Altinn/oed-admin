using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Estate.GetSigneeStatus;

public class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IAltinnClient altinnClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estate = await dbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);

        if (estate is null)
            return TypedResults.BadRequest();

        if (estate.InstanceId is null or { Length: 0 })
            return TypedResults.Ok(new Response(null));

        var parts = estate.InstanceId.Split("/");

        if (parts is null or { Length: not 2 } ||
            !int.TryParse(parts[0], out var instanceOwnerPartyId) ||
            !Guid.TryParse(parts[1], out var instanceGuid))
        {
            return TypedResults.Ok(new Response(null));
        }

        return TypedResults.Ok(
            new Response(
                await altinnClient.GetOedSigneeStatus(instanceOwnerPartyId, instanceGuid)));
    }
}