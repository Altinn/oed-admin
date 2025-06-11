using Microsoft.EntityFrameworkCore;
using oed_admin.Infrastructure.Database.Model;

namespace oed_admin.Infrastructure.Database;

public class OedDbContext(DbContextOptions<OedDbContext> options) : DbContext(options)
{
    public DbSet<Estate> Estate { get; init; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("oed");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(OedDbContext).Assembly);
    }
}