using Altinn.Platform.Storage.Interface.Models;

namespace oed_admin.Server.Features.Estate.GetInstance;

/// <param name="InstanceData">The oed element's XML from Storage, for an estate without an oed.estate_model row.</param>
/// <param name="Model">The estate's oed.estate_model row as JSON, once it has one. Then InstanceData is null.</param>
public record Response(Instance? Instance, string? InstanceData, string? Model);