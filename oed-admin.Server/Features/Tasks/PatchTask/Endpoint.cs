using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Tasks.PatchTask;

public static class Endpoint
{
    public static async Task<IResult> Patch(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();
        
        var task = await dbContext.TaskQueue
            .SingleOrDefaultAsync(item => item.Id == request.TaskId);

        if (task is null)
            return TypedResults.BadRequest();

        if (request.TaskValues.Scheduled is not null)
        {
            task.Scheduled = request.TaskValues.Scheduled.Value.ToUniversalTime();
        }

        if (request.TaskValues.Attempts is not null)
        {
            task.Attempts = request.TaskValues.Attempts.Value;
        }

        await dbContext.SaveChangesAsync();

        var dto = PoorMansMapper.Map<Infrastructure.Database.Oed.Model.TaskQueueItem, TaskDto>(task);
        return TypedResults.Ok(new Response(dto!));
    }
}