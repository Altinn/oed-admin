using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.EstateCount;

namespace oed_admin.Server.Features.Maintenance.EstateCount.CancelCount;

public static class Endpoint
{
    public static IResult Delete([FromServices] EstateCountState state) =>
        state.TryCancel()
            ? TypedResults.Accepted(string.Empty)
            : TypedResults.NotFound();
}
