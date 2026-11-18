using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.OedModel;

namespace oed_admin.Server.Features.Estate.GetInstance;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IAltinnClient storageClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estate = await dbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);

        if (estate is null)
            return TypedResults.BadRequest();

        if (estate.InstanceId is null or {Length: 0})
            return TypedResults.Ok(new Response(null, null, null));

        var parts = estate.InstanceId.Split("/");

        if (parts is null or {Length: not 2})
            return TypedResults.Ok(new Response(null, null, null));

        if (!int.TryParse(parts[0], out var instanceOwnerPartyId))
            return TypedResults.Ok(new Response(null, null, null));

        if (!Guid.TryParse(parts[1], out var instanceGuid))
            return TypedResults.Ok(new Response(null, null, null));

        var instance = await storageClient.GetInstance(
            instanceOwnerPartyId,
            instanceGuid);

        // Row first (Altinn/oed#1903): once the estate has an oed.estate_model row, its oed element in
        // Storage is a frozen copy and is never shown. A row of another party is shown as no data.
        var row = await dbContext.EstateModel
            .AsNoTracking()
            .Where(m => m.InstanceGuid == instanceGuid)
            .Select(m => new { m.InstanceOwnerPartyId, m.Model })
            .SingleOrDefaultAsync();

        if (row is not null)
        {
            var model = row.InstanceOwnerPartyId == instanceOwnerPartyId ? row.Model : null;
            return TypedResults.Ok(new Response(instance, null, model));
        }

        if (instance is null)
            return TypedResults.Ok(new Response(instance, null, null));

        var dataElement = OedDataElement.Find(instance);

        if (dataElement is null || !Guid.TryParse(dataElement.Id, out var dataGuid))
            return TypedResults.Ok(new Response(instance, null, null));

        var instanceData = await storageClient.GetInstanceDataAsString(
            instanceOwnerPartyId,
            instanceGuid,
            dataGuid);

        return TypedResults.Ok(new Response(instance, instanceData, null));
    }
}