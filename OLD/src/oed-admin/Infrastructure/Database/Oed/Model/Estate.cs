using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;

namespace oed_admin.Infrastructure.Database.Oed.Model;

public class Estate
{
    public Guid Id { get; init; }
    public required string DeceasedNin { get; init; }
    public int DeceasedPartyId { get; init; }
    public required string DeceasedName { get; init; }
    public DateOnly DateOfDeath { get; set; }
    public required string InstanceId { get; init; }
    public string? DeclarationInstanceId { get; private set; }

    public string? CaseId { get; private set; }
    public string? CaseNumber { get; private set; }
    public string? CaseStatus { get; private set; }
    public string? DistrictCourtName { get; private set; }

    public string? ProbateResult { get; private set; } = null;

    public DateTimeOffset Created { get; init; }
    public DateTimeOffset? ProbateDeadline { get; private set; } = null;
    public DateTimeOffset? FirstHeirReceived { get; private set; } = null;
    public DateTimeOffset? DelarationCreated { get; private set; } = null;
    public DateTimeOffset? DeclarationSubmitted { get; private set; } = null;
    public DateTimeOffset? ProbateIssued { get; private set; } = null;
}


public class EstateConfiguration : IEntityTypeConfiguration<Estate>
{
    public void Configure(EntityTypeBuilder<Estate> builder)
    {
        builder.ToTable("estate");
        builder.HasKey(estate => estate.Id);
    }
}