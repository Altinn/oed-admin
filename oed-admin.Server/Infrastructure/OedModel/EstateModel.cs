using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace oed_admin.Server.Infrastructure.OedModel;

/// <summary>
/// The names of <c>oed.estate_model</c> and its columns, as the oed app defines them
/// (digdir/oed <c>App/Infrastructure/OedModel/EstateModelTable.cs</c>).
/// </summary>
public static class EstateModelTable
{
    public const string Schema = "oed";
    public const string Name = "estate_model";

    public static class Columns
    {
        public const string InstanceGuid = "instance_guid";
        public const string InstanceOwnerPartyId = "instance_owner_party_id";
        public const string EstateId = "estate_id";
        public const string Model = "model";
    }
}

/// <summary>
/// One estate's OED_M, moved out of Storage into <c>oed.estate_model</c> (Altinn/oed#1884). Once an estate has a
/// row, the row is its only truth and the Storage element is a frozen copy.
/// </summary>
/// <remarks>
/// <para><b>Read-only.</b> The table is owned and written by the oed app. Never <c>Add</c>, <c>Update</c> or
/// <c>Remove</c> it: oed's <c>OedModelWriteGuardTests</c> can't see this repo, so <see cref="Database.Oed.OedDbContext"/>
/// refuses to save any change to it instead.</para>
/// <para>Only the columns oed-admin reads are mapped. Read <see cref="Model"/> through <see cref="OedModelJson"/>.</para>
/// </remarks>
public sealed class EstateModel
{
    public Guid InstanceGuid { get; init; }
    public int InstanceOwnerPartyId { get; init; }
    public Guid EstateId { get; init; }
    public string Model { get; init; } = string.Empty;
}

public class EstateModelConfiguration : IEntityTypeConfiguration<EstateModel>
{
    public void Configure(EntityTypeBuilder<EstateModel> builder)
    {
        builder.ToTable(EstateModelTable.Name, EstateModelTable.Schema);
        builder.HasKey(m => m.InstanceGuid);

        builder.Property(m => m.InstanceGuid)
            .HasColumnName(EstateModelTable.Columns.InstanceGuid)
            .ValueGeneratedNever();
        builder.Property(m => m.InstanceOwnerPartyId)
            .HasColumnName(EstateModelTable.Columns.InstanceOwnerPartyId);
        builder.Property(m => m.EstateId)
            .HasColumnName(EstateModelTable.Columns.EstateId);
        builder.Property(m => m.Model)
            .HasColumnName(EstateModelTable.Columns.Model)
            .HasColumnType("jsonb");

        builder.HasIndex(m => m.EstateId).IsUnique();
    }
}
