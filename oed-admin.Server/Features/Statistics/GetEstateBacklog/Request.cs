namespace oed_admin.Server.Features.Statistics.GetEstateBacklog;

public enum BacklogResolution
{
    Day,
    Week,
    Month
}

public record Request(BacklogResolution? Resolution, DateTimeOffset? From, DateTimeOffset? To)
{
    /// <summary>
    /// Earliest allowed value for From (and the floor applied when From is omitted). Bounds the
    /// number of periods a single request can generate and keeps period arithmetic away from the
    /// limits of DateTimeOffset.
    /// </summary>
    public static readonly DateTimeOffset EarliestFrom = new(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);

    public BacklogResolution ResolutionOrDefault => Resolution ?? BacklogResolution.Day;

    /// <summary>
    /// No default for From: when omitted, the series starts at the period containing the earliest
    /// declaration, which is only known after querying.
    /// </summary>
    public DateTimeOffset ToOrDefault => To ?? DateTimeOffset.UtcNow;

    public bool IsValid() =>
        (Resolution is null || Enum.IsDefined(Resolution.Value)) &&
        (From is null || From < ToOrDefault) &&
        (From is null || From >= EarliestFrom) &&
        (To is null || To <= DateTimeOffset.UtcNow.AddDays(1));
}
