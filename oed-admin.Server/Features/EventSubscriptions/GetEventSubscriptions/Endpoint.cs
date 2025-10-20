using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.EventSubscriptions.GetEventSubscriptions;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [FromServices] IAltinnClient altinnClient)
    {
        return TypedResults.Ok(await altinnClient.GetEventSubscriptions());
    }
}