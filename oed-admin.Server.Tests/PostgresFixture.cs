using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Authz.Model;
using oed_admin.Server.Infrastructure.Database.Oed;
using oed_admin.Server.Infrastructure.Database.Oed.Model;
using Testcontainers.PostgreSql;

namespace oed_admin.Server.Tests;

/// <summary>
/// One Postgres container per test run. The schema comes from oed-admin's own model through
/// <c>EnsureCreated</c>: the <c>oed</c> database is owned by the oed app, and oed-admin has no migrations.
/// Needs Docker.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:16-alpine").Build();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        await using var dbContext = new SchemaOnlyDbContext(Options());
        await dbContext.Database.EnsureCreatedAsync();
    }

    /// <summary>
    /// OedDbContext applies every configuration in the assembly, so its model also holds the oedauthz entities
    /// (with Postgres enum types EnsureCreated can't create). They live in another database, so the schema is
    /// created without them.
    /// </summary>
    private sealed class SchemaOnlyDbContext(DbContextOptions<OedDbContext> options) : OedDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Ignore<RoleAssignment>();
            modelBuilder.Ignore<RoleAssignmentLog>();
        }
    }

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    public OedDbContext CreateDbContext() => new(Options());

    /// <summary>For a test host that registers <c>OedDbContext</c> itself, as <c>Program.cs</c> does.</summary>
    public string ConnectionString => _container.GetConnectionString();

    private DbContextOptions<OedDbContext> Options() =>
        new DbContextOptionsBuilder<OedDbContext>()
            .UseNpgsql(_container.GetConnectionString())
            .UseSnakeCaseNamingConvention()
            .Options;

    /// <summary>
    /// Inserts an estate and its model row. The row goes in through SQL, as oed writes it, so the JSON passes
    /// through a real <c>jsonb</c> column and comes back with its keys reordered.
    /// </summary>
    public async Task<Guid> InsertEstateWithModel(
        Guid instanceGuid, int instanceOwnerPartyId, string modelJson, string? deceasedNin = null, DateTimeOffset? created = null)
    {
        var estateId = await InsertEstate(instanceGuid, instanceOwnerPartyId, deceasedNin, created);

        await using var dbContext = CreateDbContext();
        await dbContext.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO oed.estate_model (instance_guid, instance_owner_party_id, estate_id, model) VALUES ({instanceGuid}, {instanceOwnerPartyId}, {estateId}, {modelJson}::jsonb)");

        return estateId;
    }

    public async Task<Guid> InsertEstate(
        Guid instanceGuid, int instanceOwnerPartyId, string? deceasedNin = null, DateTimeOffset? created = null)
    {
        var estate = new Estate
        {
            Id = Guid.NewGuid(),
            DeceasedNin = deceasedNin ?? "01015012345",
            DeceasedPartyId = instanceOwnerPartyId,
            DeceasedName = "Test Testesen",
            InstanceId = $"{instanceOwnerPartyId}/{instanceGuid}",
            Created = created ?? DateTimeOffset.UtcNow,
        };

        await using var dbContext = CreateDbContext();
        dbContext.Estate.Add(estate);
        await dbContext.SaveChangesAsync();
        return estate.Id;
    }
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Postgres";
}
