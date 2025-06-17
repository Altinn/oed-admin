namespace oed_admin.Server.Features.Tasks.GetTasks;

public record Response(int Page, int PageSize, List<TaskDto> Tasks);