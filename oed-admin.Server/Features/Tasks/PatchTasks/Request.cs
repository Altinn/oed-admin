using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Server.Features.Tasks.PatchTasks;

public record Request
{
    [FromBody] public required TasksPatchDto TaskValues { get; init; }

    public bool IsValid()
    {
        if (TaskValues is not { TaskIds.Count: > 0 })
            return false;

        if (TaskValues.Scheduled is not null)
        {
            if (TaskValues.Scheduled.Value == default ||
                TaskValues.Scheduled.Value == DateTimeOffset.MinValue)
            {
                return false;
            }
        }

        if (TaskValues.Attempts is < 0 or > 10)
            return false;

        return true;
    }
}