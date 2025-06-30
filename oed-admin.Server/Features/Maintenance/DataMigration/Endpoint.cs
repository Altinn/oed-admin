using System.Threading.Channels;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.DataMigration;

namespace oed_admin.Server.Features.Maintenance.DataMigration;

public record Request(int BatchSize, bool UpdateExisting)
{
    public bool IsValid()
    {
        return BatchSize > 0;
    }
}
public record Response;

public static class Endpoint
{
    public static async Task<IResult> Post(
        [FromBody] Request request,
        [FromServices] Channel<DataMigrationTrigger> channel)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var success = channel.Writer.TryWrite(
            new DataMigrationTrigger(
                DateTimeOffset.UtcNow, 
                request.BatchSize,
                request.UpdateExisting));

        return success ? TypedResults.Accepted(string.Empty) : TypedResults.Conflict();
    }
}