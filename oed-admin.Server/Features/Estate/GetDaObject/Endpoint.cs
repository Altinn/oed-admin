using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;
using System.Net;
using System.Text.Json;

namespace oed_admin.Server.Features.Estate.GetDaObject;

public static class Endpoint
{
    public static async Task<IResult> Post(
        [FromBody] Request request,
        [FromServices] IFeedPollerClient feedPollerClient)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var daObject = await feedPollerClient.GetDaObject(request.CaseId);

        return TypedResults.Ok(new Response(daObject));
    }
}