namespace oed_admin.Server.Features.Statistics.GetEstateCreated;

/// <summary>
/// One entry per UTC day, oldest first, with no gaps. The last entry is today and is therefore a
/// partial day.
/// </summary>
public record Response(IReadOnlyList<DayCountDto> Days);

public record DayCountDto(DateOnly Day, int Created);
