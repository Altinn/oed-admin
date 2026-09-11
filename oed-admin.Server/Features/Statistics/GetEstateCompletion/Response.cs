namespace oed_admin.Server.Features.Statistics.GetEstateCompletion;

public record Response(IReadOnlyList<CohortDto> Cohorts);

/// <summary>
/// One monthly cohort, keyed by the UTC month the estates were opened in. The rates are
/// deliberately cohort rates, not period rates: an estate opened in July that reaches probate in
/// October counts towards July. Recent cohorts are therefore structurally incomplete and must not
/// be read as a decline.
/// </summary>
public record CohortDto(
    string Month,
    int Opened,
    int DeclarationSubmitted,
    int ProbateIssued,
    decimal PctDeclarationSubmitted,
    decimal PctProbateIssued);
