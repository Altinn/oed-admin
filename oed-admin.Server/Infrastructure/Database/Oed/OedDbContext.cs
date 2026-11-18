using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed.Model;
using oed_admin.Server.Infrastructure.OedModel;

namespace oed_admin.Server.Infrastructure.Database.Oed;

public class OedDbContext(DbContextOptions<OedDbContext> options) : DbContext(options)
{
    public DbSet<Estate> Estate { get; init; }
    public DbSet<TaskQueueItem> TaskQueue { get; init; }

    /// <summary>Read-only: owned by the oed app. See <see cref="OedModel.EstateModel"/>.</summary>
    public DbSet<EstateModel> EstateModel { get; init; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("oed");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OedDbContext).Assembly);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ThrowIfEstateModelChanged();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ThrowIfEstateModelChanged();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void ThrowIfEstateModelChanged()
    {
        if (ChangeTracker.Entries<EstateModel>().Any(entry =>
                entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
        {
            throw new InvalidOperationException(
                "oed.estate_model is owned by the oed app; oed-admin must never write it");
        }
    }
}
