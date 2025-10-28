using Azure;
using Azure.Data.Tables;
using System.Text.Json;

namespace oed_admin.Server.Infrastructure.Auditing.Loggers;

public class AzureTableAuditLogger(TableServiceClient tableServiceClient) : IAuditLogger
{
    public async Task LogAsync(AuditLogRecord logRecord)
    {
        var userRecord = new TableStoreRecord
        {
            // UserRecords are using the userId as PartitionKey
            PartitionKey = logRecord.User.Id,
            RowKey = logRecord.Request.TraceId,

            UserId = logRecord.User.Id,
            UserName = logRecord.User.Name,
            UserRoles = string.Join(", ", logRecord.User.Roles),
            Estates = string.Join(", ", logRecord.Estates?.Select(e => e.Id.ToString()) ?? []),
            Path = logRecord.Request.Path,
            Details = JsonSerializer.Serialize(logRecord)
        };

        var userTableClient = tableServiceClient.GetTableClient("audituser");
        var userResponse = await userTableClient.AddEntityAsync(userRecord);
        
        if (userResponse.IsError)
        {
            throw new Exception($"Unable to persist auditlog (user): [{userResponse.Status}] - {userResponse.ReasonPhrase}");
        }


        var estatesRecords = logRecord.Estates?.Select(estate =>
            new TableStoreRecord
            {
                // EstateRecords are using the estateId as PartitionKey
                PartitionKey = estate.Id,
                RowKey = logRecord.Request.TraceId,

                UserId = logRecord.User.Id,
                UserName = logRecord.User.Name,
                UserRoles = string.Join(", ", logRecord.User.Roles),
                Estates = string.Join(", ", logRecord.Estates?.Select(e => e.Id.ToString()) ?? []),
                Path = logRecord.Request.Path,
                Details = JsonSerializer.Serialize(logRecord)
            }) ?? [];
        
        var estateTableClient = tableServiceClient.GetTableClient("auditestate");

        foreach (var estateRecord in estatesRecords)
        {
            var estateResponse = await estateTableClient.AddEntityAsync(estateRecord);
            if (estateResponse.IsError)
            {
                throw new Exception($"Unable to persist auditlog (estate): [{estateResponse.Status}] - {estateResponse.ReasonPhrase}");
            }
        }
    }
}

public record TableStoreRecord : ITableEntity
{
    public required string PartitionKey { get; set; }
    public required string RowKey { get; set; }
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string UserRoles { get; set; } = string.Empty;
    public string Estates { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
}