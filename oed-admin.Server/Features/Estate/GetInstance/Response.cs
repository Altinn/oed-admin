using Altinn.Platform.Storage.Interface.Models;

namespace oed_admin.Server.Features.Estate.GetInstance;

public record Response(Instance? Instance, string? InstanceData);