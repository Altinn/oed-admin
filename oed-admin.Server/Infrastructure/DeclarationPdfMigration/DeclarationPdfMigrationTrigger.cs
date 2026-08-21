namespace oed_admin.Server.Infrastructure.DeclarationPdfMigration;

/// <param name="Limit">Maximum number of estates to process, or null for all of them.</param>
/// <param name="DryRun">Enumerate and report the count without calling the oed endpoint.</param>
public record DeclarationPdfMigrationTrigger(
    DateTimeOffset Timestamp,
    int? Limit,
    bool Overwrite,
    bool DryRun);
