namespace oed_admin.Server.Features.Tasks.PatchTasks;

public class TasksPatchDto
{
    public required List<Guid> TaskIds { get; set; }
    public DateTimeOffset? Scheduled { get; set; }
    public int? Attempts { get; set; }
}