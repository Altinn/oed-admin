namespace oed_admin.Server.Features.Estate.GetRoleAssignments;

public record Response(Guid EstateId, List<RoleAssignmentDto> RoleAssignments);