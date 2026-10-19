using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Statistics.GetEstateCreated;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest();

        var firstDay = request.FromOrDefault;
        var lastDay = request.ToOrDefault;
        var from = new DateTimeOffset(firstDay.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var to = new DateTimeOffset(lastDay.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);

        // Every estate counts, cancelled and misposted ones included: this tab measures how many
        // estates the service opens, not how many go on to be settled.
        var created = await dbContext.Estate
            .AsNoTracking()
            .Where(estate => estate.Created >= from && estate.Created < to)
            .Select(estate => estate.Created)
            .ToListAsync(cancellationToken);

        // Bucketed on the UTC value in memory rather than with a GROUP BY, for the same reason as
        // GetEstateCompletion: date_part on a timestamptz follows the session TimeZone.
        var perDay = created
            .GroupBy(timestamp => DateOnly.FromDateTime(timestamp.UtcDateTime))
            .ToDictionary(group => group.Key, group => group.Count());

        var days = Enumerable.Range(0, lastDay.DayNumber - firstDay.DayNumber + 1)
            .Select(offset => firstDay.AddDays(offset))
            .Select(day => new DayCountDto(day, perDay.GetValueOrDefault(day)))
            .ToList();

        return TypedResults.Ok(new Response(days));
    }
}
