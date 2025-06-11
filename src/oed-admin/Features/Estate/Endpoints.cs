namespace oed_admin.Features.Estate;

public static class Endpoints
{
    public static void MapEstateEndpoints(this WebApplication app)
    {
        app
            .MapGroup("/api/estate")
            .MapPost("/search", Search.Endpoint.Post);
            //.RequireAuthorization();
    }
}