using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Authz;

namespace oed_admin.Server.Features.Superadmin.RevokeSuperadmin;

public class Endpoint
{
    public static async Task<IResult> Delete(
    [FromHeader(Name = "X-Nin")] string nin,
    [FromServices] AuthzDbContext authzDbContext)
    {
        var res = await authzDbContext.RoleAssignments
            .Where(assignment =>
                assignment.RecipientSsn == nin &&
                assignment.RoleCode == SuperadminRoles.Superadmin)
            .ExecuteDeleteAsync();

        return TypedResults.Ok(new Response(res));
    }
}
