namespace oed_admin.Features.Estate;

public static class Endpoints
{
    public static void MapEstateEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/estate");
        //.RequireAuthorization();
        
        group.MapGet("/{id:guid}", GetEstate.Endpoint.Get);
        group.MapPost("/search", Search.Endpoint.Post);
    }
}