using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed.Model;

namespace oed_admin.Server.Infrastructure.Database.Oed;

public class OedDbContext(DbContextOptions<OedDbContext> options) : DbContext(options)
{
    public DbSet<Estate> Estate { get; init; }
    public DbSet<TaskQueueItem> TaskQueue { get; init; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("oed");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OedDbContext).Assembly);
    }
}