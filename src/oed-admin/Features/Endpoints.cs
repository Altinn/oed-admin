namespace oed_admin.Features;

public static class Endpoints
{
    public static void MapFeatureEndpoints(this WebApplication app)
    {
        app.MapEstateEndpoints();
        app.MapInstanceEndpoints();
    }

    public static RouteGroupBuilder MapEstateEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/estate");
        //.RequireAuthorization();

        group.MapGet("/{id:guid}", Estate.GetEstate.Endpoint.Get);
        group.MapPost("/search", Estate.Search.Endpoint.Post);

        return group;
    }

    public static RouteGroupBuilder MapInstanceEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/instance");
        //.RequireAuthorization();

        group.MapGet("/{instanceOwnerPartyId:int}/{instanceGuid:guid}", Instance.GetInstance.Endpoint.Get);
        group.MapGet("/{instanceOwnerPartyId:int}/{instanceGuid:guid}/data/{dataGuid:guid}", Instance.GetInstanceData.Endpoint.Get);

        return group;
    }
}