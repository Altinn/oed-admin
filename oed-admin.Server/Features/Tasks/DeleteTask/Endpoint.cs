using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Tasks.DeleteTask;

public static class Endpoint
{
    public static async Task<IResult> Delete(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        // The oed worker claims tasks with FOR UPDATE SKIP LOCKED and sets Executed in the same
        // transaction. This DELETE waits on a claimed row and re-checks Executed once the lock is
        // released, so a task that is being executed is never deleted.
        var deletedCount = await dbContext.TaskQueue
            .Where(item => item.Id == request.TaskId && item.Executed == null)
            .ExecuteDeleteAsync();

        if (deletedCount > 0)
            return TypedResults.NoContent();

        var exists = await dbContext.TaskQueue
            .AsNoTracking()
            .AnyAsync(item => item.Id == request.TaskId);

        return exists
            ? TypedResults.Conflict()
            : TypedResults.NotFound();
    }
}
