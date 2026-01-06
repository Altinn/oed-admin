using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.EventSubscriptions.DeleteEventSubscription;

public static class Endpoint
{
    public static async Task<IResult> Delete(
        [FromRoute] int id,
        [FromServices] IAltinnClient altinnClient)
    {
        return TypedResults.Ok(await altinnClient.DeleteEventSubscription(id));
    }
}