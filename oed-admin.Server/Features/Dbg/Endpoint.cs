using System.Text.Json;
using Azure;
using Azure.Data.Tables;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Auditing;

namespace oed_admin.Server.Features.Dbg;

public static class Endpoint
{
    public static Task<Response> Get([FromServices] IHttpContextAccessor contextAccessor)
    {
        var context = contextAccessor.HttpContext;
        return Task.FromResult(new Response(context?.User?.Identity?.Name ?? string.Empty));
        //return new Response(context.Request.Headers.ToDictionary(pair => pair.Key, pair => pair.Value.ToString()));
    }
}

public static class HeadersEndpoint
{
    public static Task<HeadersResponse> Get([FromServices] IHttpContextAccessor contextAccessor)
    {
        var context = contextAccessor.HttpContext;

        return Task.FromResult(
            new HeadersResponse(
                context?.Request.Headers.ToDictionary(pair =>
                    pair.Key, pair => pair.Value.ToString()) ??
                new Dictionary<string, string>()));
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

public static class TableStoreTest
{
    public static async Task<IResult> Get(
        [FromServices] TableServiceClient tableServiceClient,
        [FromServices] ILoggerFactory loggerFactory)
    {
        var logger = loggerFactory.CreateLogger(nameof(TableStoreTest));

        var auditRecord = new AuditLogRecord(
            new UserDetails("123", "Test Testesen", ["Admin"]),
            new RequestDetails(Guid.NewGuid().ToString(), "https://test.no/test", "", "{}"),
            new ResponseDetails(200),
            [new EstateDetails(Guid.NewGuid().ToString())]);
        
        var userRecord = new TableStoreRecord
        {
            // UserRecords are using the userId as PartitionKey
            PartitionKey = auditRecord.User.Id,
            RowKey = auditRecord.Request.TraceId,

            UserId = auditRecord.User.Id,
            UserName = auditRecord.User.Name,
            UserRoles = string.Join(", ", auditRecord.User.Roles),
            Estates = string.Join(", ", auditRecord.Estates?.Select(e => e.Id.ToString()) ?? []),
            Path = auditRecord.Request.Path,
            Details = JsonSerializer.Serialize(auditRecord)
        };
        
        var estatesRecords = auditRecord.Estates?.Select(estate =>
            new TableStoreRecord
            {
                // EstateRecords are using the estateId as PartitionKey
                PartitionKey = estate.Id,
                RowKey = auditRecord.Request.TraceId,

                UserId = auditRecord.User.Id,
                UserName = auditRecord.User.Name,
                UserRoles = string.Join(", ", auditRecord.User.Roles),
                Estates = string.Join(", ", auditRecord.Estates?.Select(e => e.Id.ToString()) ?? []),
                Path = auditRecord.Request.Path,
                Details = JsonSerializer.Serialize(auditRecord)
            });


        var userTableClient = tableServiceClient.GetTableClient("audituser");
        var estateTableClient = tableServiceClient.GetTableClient("auditestate");

        var userResponse = await userTableClient.UpsertEntityAsync(userRecord, TableUpdateMode.Replace);

        logger.LogInformation("UserResponse: {status} {requestId} {reason}",
            userResponse.Status, userResponse.ClientRequestId, userResponse.ReasonPhrase);

        var transactionActions = estatesRecords?.Select(record =>
            new TableTransactionAction(TableTransactionActionType.UpsertReplace, record));

        var estateResponse = await estateTableClient.SubmitTransactionAsync(transactionActions);

        foreach (var resp in estateResponse.Value)
        {
            logger.LogInformation("EstateResponse: {status} {requestId} {reason}",
                resp.Status, resp.ClientRequestId, resp.ReasonPhrase);
        }

        return TypedResults.Ok();
    }
}


public record HeadersResponse(Dictionary<string, string> Headers);
public record Response(string Name);