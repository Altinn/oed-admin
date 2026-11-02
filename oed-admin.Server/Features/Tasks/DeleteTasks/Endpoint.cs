using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Tasks.DeleteTasks;

public static class Endpoint
{
    public static async Task<IResult> Delete(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        // Executed tasks are skipped silently. See DeleteTask.Endpoint for how this interacts
        // with the oed worker's row lock.
        var deletedCount = await dbContext.TaskQueue
            .Where(item =>
                item.Executed == null &&
                request.TaskValues.TaskIds.Contains(item.Id))
            .ExecuteDeleteAsync();

        return TypedResults.Ok(new Response(deletedCount));
    }
}
