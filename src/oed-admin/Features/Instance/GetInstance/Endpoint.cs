using Microsoft.AspNetCore.Mvc;
using oed_admin.Infrastructure.Database;

namespace oed_admin.Features.Instance.GetInstance;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        // TODO: Fetch instance and instance data from A3
        var dto = new InstanceDto();

        return TypedResults.Ok(new Response(dto));
    }
}