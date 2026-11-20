using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.Runs.GetRun;

public record Request(Guid RunId)
{
    public bool IsValid() => RunId != Guid.Empty;
}

/// <summary>One run with its progress and, once it has ended, its report (Altinn/oed#1923 §4.3).</summary>
public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        HttpContext httpContext,
        [FromServices] IOedSystemAdminClient client,
        CancellationToken cancellationToken)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        httpContext.Response.Headers.CacheControl = "no-store";
        return TypedResults.Ok(RunResponse.From(await client.GetMigrationRun(request.RunId, cancellationToken)));
    }
}
