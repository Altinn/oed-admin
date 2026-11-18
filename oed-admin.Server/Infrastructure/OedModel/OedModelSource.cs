using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;

namespace oed_admin.Server.Infrastructure.OedModel;

/// <inheritdoc />
public sealed class OedModelSource(
    OedDbContext dbContext,
    IAltinnClient storageClient,
    ILogger<OedModelSource> logger) : IOedModelSource
{
    public async Task<OedModelResult> Get(
        int instanceOwnerPartyId, Guid instanceGuid, CancellationToken cancellationToken = default)
    {
        var row = await dbContext.EstateModel
            .AsNoTracking()
            .Where(m => m.InstanceGuid == instanceGuid)
            .Select(m => new { m.InstanceOwnerPartyId, m.Model })
            .SingleOrDefaultAsync(cancellationToken);

        if (row is not null)
        {
            if (row.InstanceOwnerPartyId != instanceOwnerPartyId)
            {
                // The row is still the estate's only truth: never fall back to the frozen Storage copy.
                logger.LogWarning(
                    "The OED model row of instance {InstanceGuid} belongs to party {RowPartyId}, not {PartyId}; reading it as missing",
                    instanceGuid, row.InstanceOwnerPartyId, instanceOwnerPartyId);
                return OedModelResult.NotFound(OedModelMissing.PartyMismatch);
            }

            OedInstanceData model;
            try
            {
                model = OedModelJson.Deserialize(row.Model);
            }
            catch (JsonException ex)
            {
                throw new OedModelUnreadableException(OedModelOrigin.Database, instanceGuid, ex);
            }

            LogRead(instanceGuid, OedModelOrigin.Database);
            return OedModelResult.Found(model, OedModelOrigin.Database);
        }

        var instance = await storageClient.GetInstance(instanceOwnerPartyId, instanceGuid);
        if (instance is null)
            return OedModelResult.NotFound(OedModelMissing.NoInstance);

        var dataElement = OedDataElement.Find(instance);
        if (dataElement is null || !Guid.TryParse(dataElement.Id, out var dataGuid))
            return OedModelResult.NotFound(OedModelMissing.NoDataElement);

        OedInstanceData storageModel;
        try
        {
            storageModel = await storageClient.GetInstanceData<OedInstanceData>(instanceOwnerPartyId, instanceGuid, dataGuid);
        }
        catch (InvalidOperationException ex)
        {
            // XmlSerializer wraps every parse error, malformed XML and bad values alike, in an InvalidOperationException.
            throw new OedModelUnreadableException(OedModelOrigin.Storage, instanceGuid, ex);
        }

        LogRead(instanceGuid, OedModelOrigin.Storage);
        return OedModelResult.Found(storageModel, OedModelOrigin.Storage);
    }

    // Altinn/oed#1903 §6 verifies the switch from Storage to the row with this line.
    private void LogRead(Guid instanceGuid, OedModelOrigin origin) =>
        logger.LogInformation("OED model of instance {InstanceGuid} read from {Origin}", instanceGuid, origin);
}
