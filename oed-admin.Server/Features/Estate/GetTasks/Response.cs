using oed_admin.Server.Features.Tasks;

namespace oed_admin.Server.Features.Estate.GetTasks;

public record Response(Guid EstateId, List<TaskDto> Tasks);