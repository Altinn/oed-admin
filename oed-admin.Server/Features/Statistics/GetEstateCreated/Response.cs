namespace oed_admin.Server.Features.Statistics.GetEstateCreated;

/// <summary>
/// One entry per UTC day, oldest first, with no gaps. When the period ends today the last entry
/// is a partial day.
/// </summary>
public record Response(IReadOnlyList<DayCountDto> Days);

public record DayCountDto(DateOnly Day, int Created);
