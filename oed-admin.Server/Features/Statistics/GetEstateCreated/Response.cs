namespace oed_admin.Server.Features.Statistics.GetEstateCreated;

/// <param name="Days">
/// One entry per UTC day, oldest first, with no gaps. When the period ends today the last entry
/// is a partial day.
/// </param>
/// <param name="Hours">
/// Exactly 24 entries, hour 0 first: estates created in each hour of the day in Norwegian time,
/// summed over the whole UTC days in the period. Today is left out because it is not over.
/// </param>
public record Response(IReadOnlyList<DayCountDto> Days, IReadOnlyList<HourCountDto> Hours);

public record DayCountDto(DateOnly Day, int Created);

/// <param name="Hour">Hour of the day in Norwegian time, 0–23.</param>
public record HourCountDto(int Hour, int Created);
