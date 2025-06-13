using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;

namespace oed_admin.Server.Infrastructure.Database.Authz.Model;

public class RoleAssignment
{
    public long Id { get; set; }
    public string RoleCode { get; set; } = string.Empty;
    public string EstateSsn { get; set; } = string.Empty;
    public string? HeirSsn { get; set; }
    public string RecipientSsn { get; set; } = string.Empty;
    public DateTimeOffset Created { get; set; }
    public string? Justification { get; set; }
}


public class RoleAssignmentConfiguration : IEntityTypeConfiguration<RoleAssignment>
{
    public void Configure(EntityTypeBuilder<RoleAssignment> builder)
    {
        builder.ToTable("roleassignments");

        builder.HasKey(e => e.Id)
            .HasName("roleassignments_pkey");

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .HasColumnType("bigint");

        builder.Property(e => e.Created)
            .HasColumnName("created")
            .HasColumnType("timestamp with time zone");

        builder.Property(e => e.EstateSsn)
            .HasMaxLength(11)
            .IsFixedLength()
            .HasColumnName("estateSsn");

        builder.Property(e => e.HeirSsn)
            .HasMaxLength(11)
            .IsFixedLength()
            .HasColumnName("heirSsn");

        builder.Property(e => e.RecipientSsn)
            .HasMaxLength(11)
            .IsFixedLength()
            .HasColumnName("recipientSsn");

        builder.Property(e => e.RoleCode)
            .HasMaxLength(60)
            .HasColumnName("roleCode");

        builder.Property(e => e.Justification)
            .IsRequired(false)
            .HasMaxLength(255)
            .HasColumnName("justification");
    }
}