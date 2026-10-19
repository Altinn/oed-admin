namespace oed_admin.Server.Features.Statistics.GetEstateCreated;

/// <param name="From">First UTC day, inclusive.</param>
/// <param name="To">Last UTC day, inclusive; today when omitted.</param>
public record Request(DateOnly? From, DateOnly? To)
{
    public const int DefaultDays = 90;

    /// <summary>Bounds the size of a single request; two years is well past what the tab shows.</summary>
    public const int MaxDays = 730;

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    public DateOnly ToOrDefault => To ?? Today;

    public DateOnly FromOrDefault => From ?? ToOrDefault.AddDays(-DefaultDays);

    public bool IsValid() =>
        FromOrDefault <= ToOrDefault &&
        ToOrDefault <= Today &&
        ToOrDefault.DayNumber - FromOrDefault.DayNumber <= MaxDays;
}
