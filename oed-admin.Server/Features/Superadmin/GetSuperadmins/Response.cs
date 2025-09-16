using oed_admin.Server.Features.Estate.GetRoleAssignments;

namespace oed_admin.Server.Features.Superadmin.GetSuperadmins;
public record Response(List<RoleAssignmentDto> RoleAssignments);
