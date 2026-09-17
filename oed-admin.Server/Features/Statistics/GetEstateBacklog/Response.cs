namespace oed_admin.Server.Features.Statistics.GetEstateBacklog;

public record Response(IReadOnlyList<BacklogPointDto> Points);

/// <summary>
/// Number of ongoing estates at the end of the UTC period starting at <see cref="PeriodStart"/>.
/// For the current, unfinished period that is the count as of the request's To.
/// </summary>
public record BacklogPointDto(DateOnly PeriodStart, int Ongoing);
