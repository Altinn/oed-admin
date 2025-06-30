using Altinn.Platform.Storage.Interface.Models;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Database.Oed.Model;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;
using System.Globalization;
using System.Threading.Channels;

namespace oed_admin.Server.Infrastructure.DataMigration;

public record DataMigrationTrigger(DateTimeOffset Timestamp, int BatchSize = 50, bool UpdateExisting = false);

public class InstanceToDbDataMigration(
    IServiceScopeFactory scopeFactory,
    Channel<DataMigrationTrigger> channel,
    IAltinnClient altinnClient, 
    ILogger<InstanceToDbDataMigration> logger)
    : BackgroundService
{
    private readonly InstanceReader _instanceReader = new InstanceReader(altinnClient);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await channel.Reader.WaitToReadAsync(stoppingToken);
                if (!channel.Reader.TryRead(out var trigger))
                {
                    logger.LogError("Unable to read {triggerName}", nameof(DataMigrationTrigger));
                    continue;
                }

                logger.LogInformation("{triggerName} received at {timestamp} - Batchsize: {batchSize}, UpdateExisting: {updateExisting}",
                    nameof(DataMigrationTrigger), trigger.Timestamp, trigger.BatchSize, trigger.UpdateExisting);

                try
                {
                    await ExecuteDataMigration(trigger.BatchSize, trigger.UpdateExisting, stoppingToken);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "An exception occured during data migration");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An exception occured when reading from channel");
            }
        }
    }

    private async Task ExecuteDataMigration(int batchSize, bool updateExisting, CancellationToken stoppingToken)
    {
        var batchCount = 0;
        var instanceCount = 0;
        var skipped = 0;
        var created = 0;
        var updated = 0;
        
        //var instanceStream = _instanceReader.StreamInstances();
        var instanceBatchStream = _instanceReader.StreamInstancesInBatches(batchSize);
        
        await foreach (var batch in instanceBatchStream)
        {
            batchCount++;
            var scope = scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<OedDbContext>();

            await using var transaction = await dbContext.Database.BeginTransactionAsync(stoppingToken);

            foreach (var instance in batch)
            {
                instanceCount++;
                logger.LogInformation("{batchCount}:{count} - Handling instance {instanceId}",
                    batchCount, instanceCount, instance.Id);

                if (!int.TryParse(instance.InstanceOwner.PartyId, out var instanceOwnerPartyId))
                {
                    skipped++;
                    continue;
                }

                var instanceData = await GetOedInstanceData(instance);
                if (instanceData is null)
                {
                    skipped++;
                    continue;
                }

                if (instanceData.DeceasedInfo is null)
                {
                    logger.LogWarning("Instance {instanceId} has no DeceasedInfo => skipping", instance.Id);
                    skipped++;
                    continue;
                }

                var dbItem = await dbContext.Estate.SingleOrDefaultAsync(estate =>
                                     estate.InstanceId == instance.Id,
                                 cancellationToken: stoppingToken);

                if (dbItem is not null && !updateExisting)
                {
                    logger.LogInformation("Instance {instanceId} was found in database => skipping", instance.Id);
                    skipped++;
                    continue;
                }

                if (dbItem is null)
                {
                    logger.LogInformation("Instance {instanceId} was NOT found in the database => creating new row", instance.Id);
                    created++;

                    dbItem = new Estate { Id = Guid.NewGuid() };
                    await dbContext.Estate.AddAsync(dbItem, stoppingToken);
                }
                else
                {
                    logger.LogInformation("Instance {instanceId} was found in database => updating row", instance.Id);
                    updated++;
                }

                // Get declaration, if existing
                var declarationInstance = (await altinnClient.GetInstances(AppIds.Declaration, instanceOwnerPartyId)).FirstOrDefault();


                if (!DateOnly.TryParseExact(instanceData.DeceasedInfo.DateOfDeath, "yyyy-MM-dd", out var dateOfDeath))
                    dateOfDeath = DateOnly.MinValue;
                
                if (!DateTimeOffset.TryParseExact(instanceData.ProbateDeadline, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out var probateDeadline))
                    probateDeadline = DateTimeOffset.MinValue;

                if (!DateTimeOffset.TryParseExact(instanceData.ProbateResult?.Received, "O", CultureInfo.InvariantCulture, DateTimeStyles.None, out var probateIssued))
                    probateIssued = DateTimeOffset.MinValue;
                
                dbItem.DeceasedNin = instanceData.DeceasedInfo.Deceased.Nin ?? string.Empty;
                dbItem.DeceasedPartyId = instanceOwnerPartyId;
                dbItem.DeceasedName = FormatName(instanceData.DeceasedInfo.Deceased);
                dbItem.DateOfDeath = dateOfDeath;
                dbItem.CaseNumber = instanceData.CaseNumber;
                dbItem.CaseId = instanceData.CaseId;
                dbItem.CaseStatus = instanceData.CaseStatus;
                dbItem.DistrictCourtName = instanceData.DistrictCourtName;
                dbItem.ProbateDeadline = probateDeadline != DateTimeOffset.MinValue 
                    ? probateDeadline.ToUniversalTime() 
                    : null;
                dbItem.ProbateResult = instanceData.ProbateResult?.Result;
                dbItem.ProbateIssued = probateIssued != DateTimeOffset.MinValue 
                    ? probateIssued.ToUniversalTime() 
                    : null;
                dbItem.InstanceId = instance.Id;
                dbItem.Created = instance.Created?.ToUniversalTime() ?? DateTime.UtcNow;
                dbItem.FirstHeirReceived = instanceData.FirstHeirReceivedDate?.ToUniversalTime();

                if (declarationInstance is not null)
                {
                    dbItem.DeclarationInstanceId = declarationInstance.Id;
                    dbItem.DelarationCreated = declarationInstance.Created?.ToUniversalTime() ?? DateTime.UtcNow;
                    dbItem.DeclarationSubmitted = declarationInstance.Status.IsArchived
                        ? declarationInstance.Status.Archived?.ToUniversalTime() ?? DateTimeOffset.UtcNow
                        : null;
                }

                await dbContext.SaveChangesAsync(stoppingToken);
            }

            await transaction.CommitAsync(stoppingToken);
        }

        logger.LogInformation("Datamigration completed: Batches {batchCount}, Instances: {instanceCount}, Skipped: {skipped}, Created: {created}, Updated: {updated}",
            batchCount, instanceCount, skipped, created, updated);
    }


    private async Task<OedInstanceData?> GetOedInstanceData(Instance instance)
    {
        var dataElement = instance.Data.SingleOrDefault(element =>
            element.DataType == "oed" &&
            element.ContentType == "application/xml");

        if (dataElement is null)
            return null;

        if (!int.TryParse(instance.InstanceOwner.PartyId, out var instanceOwnerPartyId))
            return null;

        if (!Guid.TryParse(dataElement.InstanceGuid, out var instanceGuid))
            return null;

        if (!Guid.TryParse(dataElement.Id, out var dataGuid))
            return null;

        var instanceData = await altinnClient.GetInstanceData<OedInstanceData>(
            instanceOwnerPartyId,
            instanceGuid,
            dataGuid);

        return instanceData;
    }

    private string FormatName(Person person) =>
        $"{person.FirstName} {(string.IsNullOrWhiteSpace(person.MiddleName) ? "" : person.MiddleName + " ")}{person.LastName}";
}