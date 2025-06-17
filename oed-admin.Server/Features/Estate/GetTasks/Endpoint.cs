using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Estate.GetTasks;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var estateSsn = await dbContext.Estate
            .AsNoTracking()
            .Where(e => e.Id == request.EstateId)
            .Select(e => e.DeceasedNin)
            .SingleOrDefaultAsync();
        
        if (estateSsn is null)
            return TypedResults.BadRequest();

        var tasks = await dbContext.TaskQueue
            .AsNoTracking()
            .Where(item => item.EstateSsn == estateSsn)
            .OrderBy(item => item.Created)
            .ToListAsync();

        var dtos = tasks
            .Select(PoorMansMapper.Map<Infrastructure.Database.Oed.Model.TaskQueueItem, TaskDto>)
            .ToList();

        return TypedResults.Ok(new Response(request.EstateId, dtos!));
    }
}