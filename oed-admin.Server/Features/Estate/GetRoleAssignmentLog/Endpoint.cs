using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Authz;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Estate.GetRoleAssignmentLog;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext oedDbContext,
        [FromServices] AuthzDbContext authzDbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estateSsn = await oedDbContext.Estate
            .AsNoTracking()
            .Where(e => e.Id == request.EstateId)
            .Select(e => e.DeceasedNin)
            .SingleOrDefaultAsync();

        if (estateSsn is null)
            return TypedResults.Ok(new Response(request.EstateId, []));

        var log = await authzDbContext.RoleAssignmentLog
            .Where(ral => ral.EstateSsn == estateSsn)
            .AsNoTracking()
            .ToListAsync();

        var dtos = log
            .Select(PoorMansMapper.Map<Infrastructure.Database.Authz.Model.RoleAssignmentLog, RoleAssignmentLogDto>)
            .ToList();

        return TypedResults.Ok(new Response(request.EstateId, dtos!));
    }
}