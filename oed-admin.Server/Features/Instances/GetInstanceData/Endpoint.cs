using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.OedModel;

namespace oed_admin.Server.Features.Instances.GetInstanceData;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IAltinnClient storageClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        if (await IsFrozenOedElement(request, dbContext, storageClient))
            return TypedResults.NotFound();

        var instanceData = await storageClient.GetInstanceDataAsBytes(
            request.InstanceOwnerPartyId,
            request.InstanceGuid,
            request.DataGuid);

        return TypedResults.File(instanceData.Content, instanceData.ContentType);
    }

    /// <summary>
    /// Once an estate has an oed.estate_model row, its oed element in Storage is a frozen copy that nothing
    /// outside the oed app may read (Altinn/oed#1884, rule 1). Other elements on the instance are served as before.
    /// Only instances with a row cost an extra Storage call; sub-app receipts, the everyday use, never have one.
    /// </summary>
    private static async Task<bool> IsFrozenOedElement(
        Request request, OedDbContext dbContext, IAltinnClient storageClient)
    {
        var hasRow = await dbContext.EstateModel
            .AsNoTracking()
            .AnyAsync(m => m.InstanceGuid == request.InstanceGuid);
        if (!hasRow)
            return false;

        var instance = await storageClient.GetInstance(request.InstanceOwnerPartyId, request.InstanceGuid);
        var element = instance?.Data?.Find(e => Guid.TryParse(e.Id, out var id) && id == request.DataGuid);
        return element is not null && OedDataElement.IsOedElement(element);
    }
}
