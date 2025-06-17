namespace oed_admin.Server.Features.Estate.GetRoleAssignmentLog;

public record Response(Guid EstateId, List<RoleAssignmentLogDto> RoleAssignmentLog);