using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Estate.SyncDaCase;

public class Endpoint
{
    public static async Task<IResult> Post(
        [AsParameters] Request request,
        [FromServices] OedDbContext oedDbContext,
        [FromServices] IOedEventsClient oedEventsClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();
        
        var estate = await oedDbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);
        
        if (estate is null || !Guid.TryParse(estate.CaseId, out var caseId))
            return TypedResults.BadRequest();

        await oedEventsClient.SyncDaCase(caseId);
        return TypedResults.Ok();
    }
}