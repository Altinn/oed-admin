namespace oed_admin.Server.Features.Statistics.GetEstateCompletion;

/// <param name="Months">The same period counted by when things happened rather than by cohort.</param>
public record Response(IReadOnlyList<CohortDto> Cohorts, IReadOnlyList<MonthEventsDto> Months);

/// <summary>
/// What happened in one UTC month: estates opened, declarations submitted and probates issued in
/// it, each counted in its own month whenever the estate was opened. Unlike the cohort rates this
/// does not lag, but it does not say how many of a month's estates went on to complete either.
/// </summary>
public record MonthEventsDto(string Month, int Opened, int DeclarationsSubmitted, int ProbatesIssued);

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
