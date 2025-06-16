namespace oed_admin.Server.Features;

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

        group.MapGet("/{estateId:guid}", Estate.GetEstate.Endpoint.Get);
        group.MapPost("/search", Estate.Search.Endpoint.Post);

        group.MapGet("/{estateId:guid}/roleassignments", Estate.GetRoleAssignments.Endpoint.Get);
        group.MapGet("/{estateId:guid}/roleassignmentlog", Estate.GetRoleAssignmentLog.Endpoint.Get);

        group.MapPost("/{estateId:guid}/superadmin", Estate.GrantSuperadmin.Endpoint.Post);
        group.MapDelete("/{estateId:guid}/superadmin", Estate.RevokeSuperadmin.Endpoint.Delete);

        return group;
    }

    public static RouteGroupBuilder MapInstanceEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/instance");
        //.RequireAuthorization();

        //group.MapGet("/{instanceOwnerPartyId:int}/{instanceGuid:guid}", Instance.GetInstance.Endpoint.Get);
        //group.MapGet("/{instanceOwnerPartyId:int}/{instanceGuid:guid}/data/{dataGuid:guid}", Instance.GetInstanceData.Endpoint.Get);

        return group;
    }
}