using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Instances.GetInstanceData;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] IStorageClient storageClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();
        
        var instanceData = await storageClient.GetInstanceDataAsString(
            request.InstanceOwnerPartyId,
            request.InstanceGuid,
            request.DataGuid);

        return TypedResults.Ok(new Response(instanceData));
    }
}