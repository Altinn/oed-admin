using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Database.Authz.Model;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Estate.GrantSuperadmin;

public class Endpoint
{
    public static async Task<IResult> Post(
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

        var assignment = new RoleAssignment
        {
            EstateSsn = estate.DeceasedNin,
            RecipientSsn = request.Grant.Nin,
            RoleCode = EstateRoles.Superadmin,
            Created = DateTimeOffset.UtcNow,
            Justification = request.Grant.Justification
        };

        await authzDbContext.RoleAssignments
            .AddAsync(assignment);

        await authzDbContext.SaveChangesAsync();

        return TypedResults.Ok(new Response(assignment.Id));
    }
}