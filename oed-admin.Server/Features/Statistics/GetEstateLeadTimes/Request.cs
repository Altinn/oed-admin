namespace oed_admin.Server.Features.Statistics.GetEstateLeadTimes;

public record Request(DateTimeOffset? From, DateTimeOffset? To)
{
    /// <summary>
    /// Same floor as GetEstateCompletion, for the same reason: before it, Created is the time a
    /// backfilled row was written, not when the estate was opened, so every duration measured from
    /// it would be wrong.
    /// </summary>
    public DateTimeOffset FromOrDefault => From ?? GetEstateCompletion.Request.DefaultFrom;

    public DateTimeOffset ToOrDefault => To ?? DateTimeOffset.UtcNow;

    public bool IsValid() => FromOrDefault < ToOrDefault;
}
