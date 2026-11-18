using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;

namespace oed_admin.Server.Infrastructure.OedModel;

public enum OedModelOrigin { Database, Storage }

public enum OedModelMissing
{
    /// <summary>No row, and Storage has no such instance.</summary>
    NoInstance,

    /// <summary>No row, and the instance has no <c>oed</c> XML element.</summary>
    NoDataElement,

    /// <summary>The instance has a row, but for another party. Never read from Storage instead.</summary>
    PartyMismatch,
}

/// <summary>An estate's OED_M and where it came from, or why there is none.</summary>
public readonly record struct OedModelResult(OedInstanceData? Model, OedModelOrigin? Origin, OedModelMissing? Missing)
{
    public static OedModelResult Found(OedInstanceData model, OedModelOrigin origin) => new(model, origin, null);
    public static OedModelResult NotFound(OedModelMissing missing) => new(null, null, missing);
}

/// <summary>
/// The estate's model exists but can't be parsed: its row's JSON, or its Storage element's XML. Distinct from
/// other <see cref="InvalidOperationException"/>s, which are bugs rather than bad data.
/// </summary>
public sealed class OedModelUnreadableException(OedModelOrigin origin, Guid instanceGuid, Exception inner)
    : Exception($"The OED model of instance {instanceGuid} in {origin} can't be read: {inner.InnerException?.Message ?? inner.Message}", inner)
{
    public OedModelOrigin Origin { get; } = origin;
}

/// <summary>
/// Reads an estate's OED_M the way the oed app's routing reader does (Altinn/oed#1903 §2.2): from its
/// <c>oed.estate_model</c> row when it has one, and from Storage only when it doesn't. Every read of OED_M in
/// oed-admin goes through this.
/// </summary>
/// <remarks>
/// No phase setting: the rule is right before, during and after the move. An estate with a row is never read from
/// Storage, where its element is a frozen copy, not even when the row can't be read.
/// </remarks>
public interface IOedModelSource
{
    /// <exception cref="OedModelUnreadableException">The row's JSON or the Storage XML can't be read.</exception>
    /// <exception cref="HttpRequestException">Storage failed.</exception>
    Task<OedModelResult> Get(int instanceOwnerPartyId, Guid instanceGuid, CancellationToken cancellationToken = default);
}
