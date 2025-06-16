using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Estate.RevokeSuperadmin;

public class Endpoint
{
    public static async Task<IResult> Delete(
        [AsParameters] Request request,
        [FromServices] OedDbContext oedDbContext,
        [FromServices] AuthzDbContext authzDbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();
        
        var estate = await oedDbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);
        
        if (estate is null)
            return TypedResults.BadRequest();

        var res = await authzDbContext.RoleAssignments
            .Where(assignment =>
                assignment.EstateSsn == estate.DeceasedNin && 
                assignment.RoleCode == EstateRoles.Superadmin)
            .ExecuteDeleteAsync();
        
        return TypedResults.Ok(new Response(res));
    }
}