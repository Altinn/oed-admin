using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Infrastructure.Database.Authz;
using oed_admin.Infrastructure.Database.Oed;
using oed_admin.Infrastructure.Mapping;

namespace oed_admin.Features.Estate.GetRoleAssignmentLog;

public static class Endpoint
{
    public static async Task<IResult> Get(
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
            return TypedResults.Ok(new Response([]));

        var log = await authzDbContext.RoleAssignmentLog
            .Where(ral => ral.EstateSsn == estate.DeceasedNin)
            .AsNoTracking()
            .ToListAsync();

        var dtos = log
            .Select(PoorMansMapper.Map<Infrastructure.Database.Authz.Model.RoleAssignmentLog, RoleAssignmentLogDto>)
            .ToList();

        return TypedResults.Ok(new Response(dtos!));
    }
}