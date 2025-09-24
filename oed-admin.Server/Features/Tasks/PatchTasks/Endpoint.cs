using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Tasks.PatchTasks;

public static class Endpoint
{
    public static async Task<IResult> Patch(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var updatedCount = await dbContext.TaskQueue
            .Where(item =>
                item.Executed == null &&
                request.TaskValues.TaskIds.Contains(item.Id))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(
                    sp => sp.Scheduled,
                    sp => request.TaskValues.Scheduled.HasValue
                        ? request.TaskValues.Scheduled.Value.ToUniversalTime()
                        : sp.Scheduled)
                .SetProperty(
                    sp => sp.Attempts,
                    sp => request.TaskValues.Attempts ?? sp.Attempts)
            );

        return TypedResults.Ok(new Response(updatedCount));
    }
}