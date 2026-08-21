using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Instances.GetInstance;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] IAltinnClient storageClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();
        
        var instance = await storageClient.GetInstance(
            request.InstanceOwnerPartyId, 
            request.InstanceGuid);

        if (instance is null)
            return TypedResults.BadRequest();

        return TypedResults.Ok(new Response(instance));
    }
}