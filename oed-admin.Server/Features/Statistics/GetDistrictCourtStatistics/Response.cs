namespace oed_admin.Server.Features.Statistics.GetDistrictCourtStatistics;

public record Response(IReadOnlyList<DistrictCourtStatisticsDto> Courts);

/// <summary>
/// Estates opened in the period, per district court. A null <see cref="DistrictCourtName"/>
/// collects the estates with no court recorded. <see cref="OpenDeclarations"/> counts those of
/// them with a declaration created and neither submitted nor probated as of now.
/// <see cref="MedianDaysToProbate"/> is over the estates that have reached probate.
/// </summary>
public record DistrictCourtStatisticsDto(
    string? DistrictCourtName,
    int Estates,
    int OpenDeclarations,
    int ProbateIssued,
    decimal PctProbateIssued,
    double? MedianDaysToProbate);
