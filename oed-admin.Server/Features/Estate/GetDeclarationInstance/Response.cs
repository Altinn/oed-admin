using Altinn.Platform.Storage.Interface.Models;

namespace oed_admin.Server.Features.Estate.GetDeclarationInstance;

public record Response(Instance? Instance, string? InstanceData);