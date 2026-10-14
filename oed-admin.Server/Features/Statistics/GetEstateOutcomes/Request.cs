namespace oed_admin.Server.Features.Statistics.GetEstateOutcomes;

public record Request(DateTimeOffset? From, DateTimeOffset? To)
{
    /// <summary>Same floor as GetEstateCompletion; see the reasoning there.</summary>
    public DateTimeOffset FromOrDefault => From ?? GetEstateCompletion.Request.DefaultFrom;

    public DateTimeOffset ToOrDefault => To ?? DateTimeOffset.UtcNow;

    public bool IsValid() => FromOrDefault < ToOrDefault;
}
