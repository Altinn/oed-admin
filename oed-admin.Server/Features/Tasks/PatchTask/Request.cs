using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Server.Features.Tasks.PatchTask;

public record Request
{
    [FromRoute] public Guid TaskId { get; init; }
    [FromBody] public required TaskPatchDto TaskValues { get; init; }

    public bool IsValid()
    {
        if (TaskId == default || TaskId == Guid.Empty)
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