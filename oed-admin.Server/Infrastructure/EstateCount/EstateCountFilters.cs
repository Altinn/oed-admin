namespace oed_admin.Server.Infrastructure.EstateCount;

/// <summary>
/// An empty CaseStatuses means "no filter". Dates are whole days in Norwegian time, both ends
/// inclusive.
/// </summary>
/// <param name="GroupByHeirRoles">
/// Read every estate's OED_M form data from Storage and group the result by heir role. Off, the
/// count is answered by the database alone.
/// </param>
public record EstateCountFilters(
    DateOnly CreatedFrom,
    DateOnly CreatedTo,
    IReadOnlyList<string> CaseStatuses,
    bool GroupByHeirRoles)
{
    // Windows hosts without ICU only know the Windows id.
    private static readonly TimeZoneInfo Oslo =
        TimeZoneInfo.TryFindSystemTimeZoneById("Europe/Oslo", out var timeZone)
            ? timeZone
            : TimeZoneInfo.FindSystemTimeZoneById("W. Europe Standard Time");

    /// <summary>
    /// [CreatedFrom 00:00, CreatedTo + 1 day 00:00) in Oslo, as UTC instants - Npgsql only accepts
    /// offset 0 for timestamptz parameters.
    /// </summary>
    public (DateTimeOffset From, DateTimeOffset ToExclusive) CreatedRangeUtc() =>
        (StartOfDayUtc(CreatedFrom), StartOfDayUtc(CreatedTo.AddDays(1)));

    // Midnight is never inside a DST gap or overlap in Oslo (the switches are at 02:00 and 03:00),
    // so GetUtcOffset is unambiguous here.
    private static DateTimeOffset StartOfDayUtc(DateOnly date)
    {
        var localMidnight = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return new DateTimeOffset(localMidnight, Oslo.GetUtcOffset(localMidnight)).ToUniversalTime();
    }
}
