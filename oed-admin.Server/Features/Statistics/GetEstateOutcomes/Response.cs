namespace oed_admin.Server.Features.Statistics.GetEstateOutcomes;

public record Response(IReadOnlyList<OutcomeMonthDto> Months);

/// <summary>
/// One monthly cohort, keyed by the UTC month the estates were opened in.
/// <see cref="Total"/> is every estate in the cohort. <see cref="Cancelled"/> and
/// <see cref="Misposted"/> are mutually exclusive (a cancelled estate is counted as cancelled
/// whatever its case status), and <see cref="Results"/> splits the remaining estates by
/// ProbateResult, with a null result for those that have none yet.
/// </summary>
public record OutcomeMonthDto(
    string Month,
    int Total,
    int Cancelled,
    int Misposted,
    IReadOnlyList<ProbateResultCountDto> Results);

public record ProbateResultCountDto(string? Result, int Count);
