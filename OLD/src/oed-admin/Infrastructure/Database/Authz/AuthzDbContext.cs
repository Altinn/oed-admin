using Microsoft.EntityFrameworkCore;
using oed_admin.Infrastructure.Database.Authz.Model;

namespace oed_admin.Infrastructure.Database.Authz;

public class AuthzDbContext(DbContextOptions<AuthzDbContext> options) : DbContext(options)
{
    public DbSet<RoleAssignment> RoleAssignments { get; init; }
    public DbSet<RoleAssignmentLog> RoleAssignmentLog { get; init; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("oedauthz");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AuthzDbContext).Assembly);
    }
}