using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Estate.MinimalSearch;

public static class Endpoint
{
    public static async Task<IResult> Post(
        [FromBody] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IAltinnClient storageClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estate = await dbContext.Estate.AsNoTracking()
            .Where(e => e.DeceasedNin == request.Nin)
            .OrderByDescending(x => x.Created) // Need this for tt02 to work, alot of deceased have multiple instances in metadatabase
            .FirstOrDefaultAsync();

        if (estate is null)
            return TypedResults.Ok(new Response());

        var parts = estate.InstanceId.Split("/");

        if (parts is null or { Length: not 2 })
            return TypedResults.Ok(new Response());

        if (!int.TryParse(parts[0], out var instanceOwnerPartyId))
            return TypedResults.Ok(new Response());

        if (!Guid.TryParse(parts[1], out var instanceGuid))
            return TypedResults.Ok(new Response());

        var instance = await storageClient.GetInstance(
            instanceOwnerPartyId,
            instanceGuid);

        if (instance is null)
            return TypedResults.Ok(new Response());

        var dataId = instance.Data.FirstOrDefault()?.Id;

        if (dataId is null)
            return TypedResults.Ok(new Response());

        if (!Guid.TryParse(dataId, out var dataGuid))
            return TypedResults.Ok(new Response());

        var instanceData = await storageClient
            .GetInstanceData<Infrastructure.DataMigration.Models.Oed.OedInstanceData>(
            instanceOwnerPartyId,
            instanceGuid,
            dataGuid);

        var dto = PoorMansMapper.Map<Infrastructure.Database.Oed.Model.Estate, MinimalEstateDto>(estate);

        if (instanceData is null)
            return TypedResults.Ok(new Response(dto!));
        dto!.Heirs = instanceData.Heirs?
            .Select(x => new MinimalPerson(Birthdate: x.Heir.Birthday))
            .ToList() ?? [];

        return TypedResults.Ok(new Response(dto!));
    }
}
