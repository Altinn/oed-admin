using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Maintenance.OedModel.Runs.GetRunItems;

public record Request(Guid RunId, string? Outcome, int? Page, int? PageSize)
{
    public const int DefaultPageSize = 100;
    public const int MaxPageSize = 500;

    public bool IsValid() =>
        RunId != Guid.Empty
        && (Outcome is null || RunOutcomes.IsKnown(Outcome))
        && Page is null or >= 1
        && PageSize is null or (>= 1 and <= MaxPageSize);
}

/// <param name="EstateId">The estate with this instance in oed-admin's <c>estate</c> table, for a link to the estate
/// view; null when it has none.</param>
public record Item(OedModelMigrationRunItem Run, Guid? EstateId);

/// <param name="Status">oed's HTTP status, or 0 when oed never answered.</param>
public record Response(int Status, IReadOnlyList<Item>? Items, int? Page, int? PageSize, int? Total, OedAdminProblem? Problem);

/// <summary>
/// One page of a run's items, by outcome (Altinn/oed#1923 §4.3). oed's items carry only the instance; each is matched
/// read-only to its estate so the page can link to the estate view.
/// </summary>
public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        HttpContext httpContext,
        [FromServices] IOedSystemAdminClient client,
        [FromServices] OedDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        httpContext.Response.Headers.CacheControl = "no-store";

        var result = await client.GetMigrationRunItems(
            request.RunId,
            request.Outcome,
            request.Page ?? 1,
            request.PageSize ?? Request.DefaultPageSize,
            cancellationToken);

        if (result.Items is not { } page)
            return TypedResults.Ok(new Response(result.HttpStatus, null, null, null, null, result.Problem));

        var instanceIds = page.Items.Select(InstanceId).ToList();
        var estates = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => instanceIds.Contains(estate.InstanceId))
            .Select(estate => new { estate.InstanceId, estate.Id })
            .ToDictionaryAsync(estate => estate.InstanceId, estate => estate.Id, cancellationToken);

        var items = page.Items
            .Select(item => new Item(item, estates.TryGetValue(InstanceId(item), out var estateId) ? estateId : null))
            .ToList();

        return TypedResults.Ok(new Response(result.HttpStatus, items, page.Page, page.PageSize, page.Total, null));
    }

    // As oed and Storage write it, and as estate.instance_id holds it.
    private static string InstanceId(OedModelMigrationRunItem item) => $"{item.InstanceOwnerPartyId}/{item.InstanceGuid}";
}
