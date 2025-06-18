using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Mapping;

namespace oed_admin.Server.Features.Tasks.GetTasks;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var page = request.Page ?? 1;
        var pageSize = request.PageSize ?? 10;

        var query = dbContext.TaskQueue.AsNoTracking();

        var filteredQuery = request.StatusAsEnum() switch
        {
            TaskStatus.DeadLetterQueue =>
                query.Where(tqi =>
                    tqi.Executed == null &&
                    (tqi.Scheduled == null ||
                    tqi.Attempts >= 10)),
            TaskStatus.Executed =>
                query.Where(tqi => tqi.Executed != null),
            TaskStatus.Scheduled =>
                query.Where(tqi =>
                    tqi.Executed == null &&
                    tqi.Scheduled != null && 
                    tqi.Attempts == 0),
            TaskStatus.Retrying =>
                query.Where(tqi => 
                    tqi.Executed == null && 
                    tqi.Scheduled != null &&
                    tqi.Attempts > 0 && 
                    tqi.Attempts < 10),
            _ => query
        };
        
        var tasks = await filteredQuery
            .OrderByDescending(task => task.Created)
            .Skip(pageSize * (page - 1))
            .Take(pageSize)
            .ToListAsync();

        var dtos = tasks
            .Select(PoorMansMapper.Map<Infrastructure.Database.Oed.Model.TaskQueueItem, TaskDto>)
            .ToList();

        return TypedResults.Ok(new Response(page, pageSize, dtos!));
    }
}