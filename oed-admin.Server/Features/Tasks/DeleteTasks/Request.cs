using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Server.Features.Tasks.DeleteTasks;

public record Request
{
    [FromBody] public required TasksDeleteDto TaskValues { get; init; }

    public bool IsValid() => TaskValues is { TaskIds.Count: > 0 };
}
