using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Server.Features.Tasks.DeleteTask;

public record Request
{
    [FromRoute] public Guid TaskId { get; init; }

    public bool IsValid() => TaskId != Guid.Empty;
}
