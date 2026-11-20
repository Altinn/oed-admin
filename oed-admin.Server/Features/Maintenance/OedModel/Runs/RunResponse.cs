using oed_admin.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Features.Maintenance.OedModel.Runs;

/// <summary>
/// Every run endpoint's answer (Altinn/oed#1923 §4.3). 200 whatever oed said, with oed's status in the body, as for
/// phase and copy.
/// </summary>
/// <param name="Status">oed's HTTP status, or 0 when oed never answered.</param>
/// <param name="ActiveRunId">With a 409 from start: the run that is already active.</param>
public record RunResponse(int Status, OedModelMigrationRun? Run, OedAdminProblem? Problem, Guid? ActiveRunId)
{
    public static RunResponse From(OedModelMigrationRunResult result) =>
        new(result.HttpStatus, result.Run, result.Problem, result.ActiveRunId);
}

/// <summary>The outcome names oed accepts in the items filter (oed's docs/oed-model-migration.md §5.4–5.5).</summary>
public static class RunOutcomes
{
    public static readonly string[] Sweep =
        ["Copied", "AlreadyMigrated", "SkippedSoftDeleted", "NoOedElement", "InstanceNotFound", "NotAllowed", "Failed", "Busy"];

    public static readonly string[] Verify = ["Ok", "Missing", "Broken", "Mismatch", "SampleMismatch", "NotLive"];

    public static bool IsKnown(string outcome) =>
        Sweep.Contains(outcome, StringComparer.Ordinal) || Verify.Contains(outcome, StringComparer.Ordinal);
}
