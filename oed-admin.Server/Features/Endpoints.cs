using oed_admin.Server.Infrastructure.Authz;

namespace oed_admin.Server.Features;

public static class Endpoints
{
    public static void MapFeatureEndpoints(this WebApplication app)
    {
        app.MapEstateEndpoints()
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);

        app.MapTaskEndpoints()
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);

        app.MapInstanceEndpoints()
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);

        app.MapMaintenanceEndpoints()
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);

        app.MapSuperadminEndpoints()
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);

        app.MapGet("/api/secrets", SecretExpiry.GetSecrets.Endpoint.Get)
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);

        app.MapGet("/api/eventsubscriptions", EventSubscriptions.GetEventSubscriptions.Endpoint.Get)
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);

        app.MapDelete("/api/eventsubscriptions/{id:int}", EventSubscriptions.DeleteEventSubscription.Endpoint.Delete)
            .RequireAuthorization(AuthorizationPolicies.RequireAdminRole);

        app.MapPost("/api/estate/minimalsearch", Estate.MinimalSearch.Endpoint.Post)
            .RequireAuthorization(AuthorizationPolicies.AtLeastReadRole);

        app.MapGet("/api/districtcourts", DistrictCourts.GetDistrictCourts.Endpoint.Get)
            .RequireAuthorization(AuthorizationPolicies.AtLeastReadRole);
    }

    extension(WebApplication app)
    {
        public RouteGroupBuilder MapEstateEndpoints()
        {
            var group = app.MapGroup("/api/estate");

            group.MapGet("/{estateId:guid}", Estate.GetEstate.Endpoint.Get);
            group.MapPost("/search", Estate.Search.Endpoint.Post);
            group.MapGet("/{estateId:guid}/roleassignments", Estate.GetRoleAssignments.Endpoint.Get);
            group.MapGet("/{estateId:guid}/roleassignmentlog", Estate.GetRoleAssignmentLog.Endpoint.Get);
            group.MapGet("/{estateId:guid}/tasks", Estate.GetTasks.Endpoint.Get);
            group.MapGet("/{estateId:guid}/events", Estate.GetEvents.Endpoint.Get);
            group.MapGet("/{estateId:guid}/instance", Estate.GetInstance.Endpoint.Get);
            group.MapGet("/{estateId:guid}/declarationinstance", Estate.GetDeclarationInstance.Endpoint.Get);
            group.MapGet("/{estateId:guid}/probateinformation", Estate.GetProbateInformation.Endpoint.Get);
            group.MapPost("/{estateId:guid}/superadmin", Estate.GrantSuperadmin.Endpoint.Post);
            group.MapDelete("/{estateId:guid}/superadmin", Estate.RevokeSuperadmin.Endpoint.Delete);
            group.MapGet("/{estateId:guid}/searchroles", Estate.SearchRoles.Endpoint.Get);
            group.MapGet("/{estateId:guid}/correspondences", Estate.GetCorrespondences.Endpoint.Get);
            return group;
        }

        public RouteGroupBuilder MapTaskEndpoints()
        {
            var group = app.MapGroup("/api/tasks");

            group.MapGet("/", Tasks.GetTasks.Endpoint.Get);
            group.MapPatch("/", Tasks.PatchTasks.Endpoint.Patch);
            group.MapPatch("/{taskId:guid}", Tasks.PatchTask.Endpoint.Patch);

            return group;
        }

        public RouteGroupBuilder MapInstanceEndpoints()
        {
            var group = app.MapGroup("/api/instances");

            group.MapGet("/{instanceOwnerPartyId:int}/{instanceGuid:guid}", Instances.GetInstance.Endpoint.Get);
            group.MapGet("/{instanceOwnerPartyId:int}/{instanceGuid:guid}/data/{dataGuid:guid}", Instances.GetInstanceData.Endpoint.Get);

            return group;
        }

        public RouteGroupBuilder MapMaintenanceEndpoints()
        {
            var group = app.MapGroup("/api/maintenance");

            group.MapPost("/datamigration", Maintenance.DataMigration.Endpoint.Post);

            return group;
        }

        public RouteGroupBuilder MapSuperadminEndpoints()
        {
            var group = app.MapGroup("/api/superadmins");

            group.MapGet("/", Superadmin.GetSuperadmins.Endpoint.Get);
            group.MapDelete("/", Superadmin.RevokeSuperadmin.Endpoint.Delete);

            return group;
        }
    }
}