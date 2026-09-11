namespace oed_admin.Server.Features.Statistics.GetEstateCompletion;

public record Request(DateTimeOffset? From, DateTimeOffset? To)
{
    /// <summary>
    /// The oed "estate" table shipped 2025-06-11 (migration Add_Table_Estate) and the owning app's
    /// GetOrCreateEstate backfills a row for an older estate on its next case update. For those
    /// estates Created means "first case update after the table existed", not when the estate was
    /// opened, which would make early cohorts look both small and unnaturally complete. Default the
    /// floor past the backfill; a caller who wants the raw history can still ask for it.
    /// </summary>
    public static readonly DateTimeOffset DefaultFrom = new(2025, 7, 1, 0, 0, 0, TimeSpan.Zero);

    public DateTimeOffset FromOrDefault => From ?? DefaultFrom;

    public DateTimeOffset ToOrDefault => To ?? DateTimeOffset.UtcNow;

    public bool IsValid() => FromOrDefault < ToOrDefault;
}
