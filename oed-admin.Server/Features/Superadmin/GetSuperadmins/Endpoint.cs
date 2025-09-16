using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Features.Estate.GetRoleAssignments;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Superadmin.GetSuperadmins;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [FromServices] AuthzDbContext authzDbContext)
    {
        var roleAssignments = await authzDbContext.RoleAssignments
            .Where(ral => ral.RoleCode == SuperadminRoles.Superadmin)
            .AsNoTracking()
            .ToListAsync();

        var dtos = roleAssignments
            .Select(PoorMansMapper.Map<Infrastructure.Database.Authz.Model.RoleAssignment, RoleAssignmentDto>)
            .ToList();

        return TypedResults.Ok(new Response(dtos!));
    }
}
