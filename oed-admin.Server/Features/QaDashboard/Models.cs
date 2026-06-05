namespace oed_admin.Server.Features.QaDashboard;

// Aggregated QA dashboard data served by GET /api/qa and rendered natively by the React client.
// Mirrors the snapshot model the Altinn.Dd.Tests.SonarGate package writes to the oedqa "reports"
// blob container.
public sealed record QaDashboardDto(IReadOnlyList<QaProject> Projects);

public sealed record QaProject(string Name, IReadOnlyList<QaSnapshot> Snapshots);

// Snapshots are newest-first. Top findings are only populated on the latest snapshot of each
// project (the older snapshots carry metrics only, matching what the dashboard shows).
public sealed record QaSnapshot(
    DateTimeOffset Timestamp,
    string GateStatus,
    IReadOnlyDictionary<string, string> Metrics,
    IReadOnlyList<QaFinding> Bugs,
    IReadOnlyList<QaFinding> CodeSmells,
    IReadOnlyList<QaHotspot> Hotspots);

public sealed record QaFinding(string Rule, string Severity, string Component, int? Line, string Message);

public sealed record QaHotspot(string Rule, string Probability, string Category, string Component, int? Line, string Message);
