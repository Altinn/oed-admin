// Template for a vertical-slice endpoint in oed-admin.Server.
// Modelled on Features/Estate/GetEstate/. Replace <Area>, <Operation>, and the query.
// Each block below belongs in its own file inside Features/<Area>/<Operation>/.

// ---------------------------------------------------------------- Request.cs
namespace oed_admin.Server.Features.<Area>.<Operation>;

// [AsParameters] binding: properties come from the route and query string.
public record Request(Guid EstateId)
{
    // Hand-rolled validation. Guid.Empty, not default.
    public bool IsValid() => EstateId != Guid.Empty;
}

// For a JSON body instead, bind with [FromBody] and validate the fields:
// public record Request(int BatchSize, bool UpdateExisting)
// {
//     public bool IsValid() => BatchSize > 0;
// }


// --------------------------------------------------------------- Response.cs
namespace oed_admin.Server.Features.<Area>.<Operation>;

// Null payload is the conventional "not found" here — see the Ok(new Response(null)) below.
public record Response(EstateDto? Estate);

// The DTO defines the exposure surface. PoorMansMapper copies every name-matching
// property by reflection, so omit anything the caller must not see.
public class EstateDto
{
    public Guid Id { get; set; }
    public string? CaseNumber { get; set; }
    public string? CaseStatus { get; set; }
    // Do NOT add DeceasedNin / DeceasedName / DeceasedPartyId to a DTO reachable by the Read role.
}


// --------------------------------------------------------------- Endpoint.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.<Area>.<Operation>;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estate = await dbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);

        if (estate is null)
            return TypedResults.Ok(new Response(null));

        var dto = PoorMansMapper.Map<Infrastructure.Database.Oed.Model.Estate, EstateDto>(estate);
        return TypedResults.Ok(new Response(dto));
    }
}


// ------------------------------------------ Features/Endpoints.cs (register!)
// Inside the matching Map<Area>Endpoints() method:
//
//     group.MapGet("/{estateId:guid}/<operation>", <Area>.<Operation>.Endpoint.Get);
//
// Or, for a route outside any group, in MapFeatureEndpoints():
//
//     app.MapGet("/api/<area>/<operation>", <Area>.<Operation>.Endpoint.Get)
//        .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);
