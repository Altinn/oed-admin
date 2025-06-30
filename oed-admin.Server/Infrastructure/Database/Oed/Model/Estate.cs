using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;

namespace oed_admin.Server.Infrastructure.Database.Oed.Model;

public class Estate
{
    public Guid Id { get; set; }
    public string DeceasedNin { get; set; }
    public int DeceasedPartyId { get; set; }
    public string DeceasedName { get; set; }
    public DateOnly DateOfDeath { get; set; }
    public string InstanceId { get; set; }
    public string? DeclarationInstanceId { get; set; }

    public string? CaseId { get; set; }
    public string? CaseNumber { get; set; }
    public string? CaseStatus { get; set; }
    public string? DistrictCourtName { get; set; }

    public string? ProbateResult { get; set; } = null;

    public DateTimeOffset Created { get; set; }
    public DateTimeOffset? ProbateDeadline { get; set; } = null;
    public DateTimeOffset? FirstHeirReceived { get; set; } = null;
    public DateTimeOffset? DelarationCreated { get; set; } = null;
    public DateTimeOffset? DeclarationSubmitted { get; set; } = null;
    public DateTimeOffset? ProbateIssued { get; set; } = null;
}


public class EstateConfiguration : IEntityTypeConfiguration<Estate>
{
    public void Configure(EntityTypeBuilder<Estate> builder)
    {
        builder.ToTable("estate");
        builder.HasKey(estate => estate.Id);
    }
}