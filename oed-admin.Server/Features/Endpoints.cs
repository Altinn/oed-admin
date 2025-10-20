using oed_admin.Server.Infrastructure.Authz;

namespace oed_admin.Server.Features;

public static class Endpoints
{
    public static void MapFeatureEndpoints(this WebApplication app)
    {
        app.MapEstateEndpoints()
            .RequireAuthorization(AuthorizationPolicies.DigitaltDodsboAdmins);

        app.MapTaskEndpoints()
            .RequireAuthorization(AuthorizationPolicies.DigitaltDodsboAdmins);

        app.MapInstanceEndpoints()
            .RequireAuthorization(AuthorizationPolicies.DigitaltDodsboAdmins);

        app.MapMaintenanceEndpoints()
            .RequireAuthorization(AuthorizationPolicies.DigitaltDodsboAdmins);

        app.MapSuperadminEndpoints()
            .RequireAuthorization(AuthorizationPolicies.DigitaltDodsboAdmins);

        app.MapGet("/api/whoami", Dbg.Endpoint.Get);

        app.MapGet("/api/secrets", SecretExpiry.GetSecrets.Endpoint.Get)
            .RequireAuthorization(AuthorizationPolicies.DigitaltDodsboAdmins);

        app.MapGet("/api/eventsubscriptions", EventSubscriptions.GetEventSubscriptions.Endpoint.Get)
            .RequireAuthorization(AuthorizationPolicies.DigitaltDodsboAdmins);
    }

    public static RouteGroupBuilder MapEstateEndpoints(this WebApplication app)
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

        return group;
    }

    public static RouteGroupBuilder MapTaskEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/tasks");

        group.MapGet("/", Tasks.GetTasks.Endpoint.Get);
        group.MapPatch("/", Tasks.PatchTasks.Endpoint.Patch);
        group.MapPatch("/{taskId:guid}", Tasks.PatchTask.Endpoint.Patch);

        return group;
    }

    public static RouteGroupBuilder MapInstanceEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/instances");

        group.MapGet("/{instanceOwnerPartyId:int}/{instanceGuid:guid}", Instances.GetInstance.Endpoint.Get);
        group.MapGet("/{instanceOwnerPartyId:int}/{instanceGuid:guid}/data/{dataGuid:guid}", Instances.GetInstanceData.Endpoint.Get);

        return group;
    }

    public static RouteGroupBuilder MapMaintenanceEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/maintenance");

        group.MapPost("/datamigration", Maintenance.DataMigration.Endpoint.Post);

        return group;
    }

    public static RouteGroupBuilder MapSuperadminEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/superadmins");

        group.MapGet("/", Superadmin.GetSuperadmins.Endpoint.Get);
        group.MapDelete("/", Superadmin.RevokeSuperadmin.Endpoint.Delete);

        return group;
    }
}