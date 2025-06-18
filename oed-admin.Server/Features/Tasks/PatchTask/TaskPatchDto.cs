namespace oed_admin.Server.Features.Tasks.PatchTask;

public class TaskPatchDto
{
    public DateTimeOffset? Scheduled { get; set; }
    public int? Attempts { get; set; }
}