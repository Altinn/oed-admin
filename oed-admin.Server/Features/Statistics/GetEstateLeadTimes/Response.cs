namespace oed_admin.Server.Features.Statistics.GetEstateLeadTimes;

/// <param name="Overall">Each measure across the whole period.</param>
/// <param name="Months">
/// Each measure per monthly cohort, keyed by the UTC month the estates were opened in. A recent
/// cohort only contains the estates that have already reached the later step, which are the fast
/// ones, so its durations read short until the slower estates catch up.
/// </param>
public record Response(IReadOnlyList<LeadTimeDto> Overall, IReadOnlyList<LeadTimeMonthDto> Months);

public record LeadTimeMonthDto(string Month, int Estates, IReadOnlyList<LeadTimeDto> Measures);

/// <summary>
/// One duration, in days. <see cref="Count"/> is the number of estates that have reached both
/// ends of it; estates whose end comes before their start (bad data) are left out.
/// </summary>
public record LeadTimeDto(string Measure, int Count, double? MedianDays, double? P75Days);
