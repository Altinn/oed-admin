using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed.Model;
using oed_admin.Server.Infrastructure.OedModel;

namespace oed_admin.Server.Tests.OedModel;

/// <summary>
/// oed.estate_model is owned by the oed app. oed's OedModelWriteGuardTests can't see this repo, so
/// OedDbContext refuses every write to it here.
/// </summary>
[Collection(PostgresCollection.Name)]
public class EstateModelGuardTests(PostgresFixture fixture)
{
    [Fact]
    public async Task SaveChanges_WithAddedEstateModel_Throws()
    {
        var instanceGuid = Guid.NewGuid();
        var estateId = await fixture.InsertEstate(instanceGuid, 50001);

        await using (var dbContext = fixture.CreateDbContext())
        {
            dbContext.EstateModel.Add(new EstateModel
            {
                InstanceGuid = instanceGuid,
                InstanceOwnerPartyId = 50001,
                EstateId = estateId,
                Model = "{}",
            });

            await Assert.ThrowsAsync<InvalidOperationException>(() => dbContext.SaveChangesAsync());
            Assert.Throws<InvalidOperationException>(() => dbContext.SaveChanges());
        }

        await using var verify = fixture.CreateDbContext();
        Assert.False(await verify.EstateModel.AnyAsync(m => m.InstanceGuid == instanceGuid));
    }

    [Fact]
    public async Task SaveChanges_WithModifiedOrDeletedEstateModel_Throws()
    {
        var instanceGuid = Guid.NewGuid();
        await fixture.InsertEstateWithModel(instanceGuid, 50002, """{"caseNumber":"ORIGINAL"}""");

        await using (var dbContext = fixture.CreateDbContext())
        {
            var row = await dbContext.EstateModel.SingleAsync(m => m.InstanceGuid == instanceGuid);
            dbContext.Entry(row).Property(m => m.Model).CurrentValue = """{"caseNumber":"CHANGED"}""";
            await Assert.ThrowsAsync<InvalidOperationException>(() => dbContext.SaveChangesAsync());
        }

        await using (var dbContext = fixture.CreateDbContext())
        {
            var row = await dbContext.EstateModel.SingleAsync(m => m.InstanceGuid == instanceGuid);
            dbContext.EstateModel.Remove(row);
            await Assert.ThrowsAsync<InvalidOperationException>(() => dbContext.SaveChangesAsync());
        }

        await using var verify = fixture.CreateDbContext();
        var stored = await verify.EstateModel.AsNoTracking().SingleAsync(m => m.InstanceGuid == instanceGuid);
        Assert.Contains("ORIGINAL", stored.Model);
    }

    [Fact]
    public async Task SaveChanges_WithOtherEntities_Succeeds()
    {
        await using var dbContext = fixture.CreateDbContext();
        dbContext.Estate.Add(new Estate
        {
            Id = Guid.NewGuid(),
            DeceasedNin = "01015099999",
            DeceasedName = "Annen Testesen",
            InstanceId = $"50003/{Guid.NewGuid()}",
            Created = DateTimeOffset.UtcNow,
        });

        Assert.Equal(1, await dbContext.SaveChangesAsync());
    }
}
