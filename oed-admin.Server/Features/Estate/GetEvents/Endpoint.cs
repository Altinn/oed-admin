using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Estate.GetEvents;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IEventsClient eventsClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estateSsn = await dbContext.Estate
            .AsNoTracking()
            .Where(e => e.Id == request.EstateId)
            .Select(e => e.DeceasedNin)
            .SingleOrDefaultAsync();

        if (estateSsn is null)
            return TypedResults.Ok(new Response(string.Empty));

        var events = await eventsClient.GetEvents(
            EventResources.DodsboDomstoladminApi, 
            estateSsn, 
            request.LastRetrievedEventId ?? "0");

        return TypedResults.Ok(new Response(events));
    }
}