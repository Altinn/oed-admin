using CloudNative.CloudEvents.SystemTextJson;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;
using System.Text;

namespace oed_admin.Server.Features.Estate.GetEvents;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IAltinnClient eventsClient)
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

        var ddEvents = await eventsClient.GetEvents(
            EventResources.DodsboDomstoladminApi, 
            estateSsn, 
            request.LastRetrievedEventId ?? "0");

        var unsignedEvents = await eventsClient.GetEvents(
            EventResources.Declaration,
            estateSsn,
            request.LastRetrievedEventId ?? "0");

        var events = ddEvents
            .Concat(unsignedEvents)
            .OrderBy(e => e.Time ?? DateTimeOffset.MinValue)
            .ToArray();

        var formatter = new JsonEventFormatter();
        var bytes = formatter.EncodeBatchModeMessage(events, out _);
        var eventsJson = Encoding.UTF8.GetString(bytes.Span);

        return TypedResults.Ok(new Response(eventsJson));
    }
}