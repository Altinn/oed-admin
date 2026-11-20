using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;

namespace oed_admin.Server.Infrastructure.Database.Oed.Model;

public class Estate
{
    public Guid Id { get; set; }
    public string DeceasedNin { get; set; } = string.Empty;
    public int DeceasedPartyId { get; set; }
    public string DeceasedName { get; set; } = string.Empty;
    public DateOnly DateOfDeath { get; set; }
    public string InstanceId { get; set; } = string.Empty;
    public string? DeclarationInstanceId { get; set; }

    public string? CaseId { get; set; }
    public string? CaseNumber { get; set; }
    public string? CaseStatus { get; set; }
    public string? DistrictCourtName { get; set; }

    public string? ProbateResult { get; set; }

    public DateTimeOffset Created { get; set; }
    public DateTimeOffset? ProbateDeadline { get; set; }
    public DateTimeOffset? FirstHeirReceived { get; set; }
    public DateTimeOffset? DelarationCreated { get; set; }
    public DateTimeOffset? DeclarationSubmitted { get; set; }
    public DateTimeOffset? ProbateIssued { get; set; }

    public DateTimeOffset? AccessDate { get; set; }
    public bool? IsCancelled { get; set; }
}


public class EstateConfiguration : IEntityTypeConfiguration<Estate>
{
    public void Configure(EntityTypeBuilder<Estate> builder)
    {
        builder.ToTable("estate");
        builder.HasKey(estate => estate.Id);

        // As the oed app's EstateConfiguration: one estate row per instance. oed-admin has no migrations, so this
        // only shapes EnsureCreated in tests.
        builder.HasIndex(estate => estate.InstanceId, "estate_instance_id_idx").IsUnique();
    }
}