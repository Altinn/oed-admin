using System.Text.Json;
using System.Text.Json.Nodes;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;
using oed_admin.Server.Infrastructure.OedModel;

namespace oed_admin.Server.Tests.OedModel;

/// <summary>
/// oed-admin must read what oed stores in <c>oed.estate_model.model</c>.
/// <c>TestData/oed_model_storage_contract.json</c> is a copy of oed's snapshot
/// <c>ApiTest/ContractSnapshots/oed_model_storage_contract.json</c> (digdir/oed, commit b6efb99b), which pins the
/// stored shape. When oed changes that snapshot, copy it here again and run these tests.
/// </summary>
public class OedModelJsonContractTests
{
    private static string Snapshot() => File.ReadAllText(Path.Combine("TestData", "oed_model_storage_contract.json"));

    [Fact]
    public void Snapshot_Deserializes_WithAllHeirSubtypes()
    {
        var model = OedModelJson.Deserialize(Snapshot());

        AssertSnapshotModel(model);
    }

    [Fact]
    public void Snapshot_WithTypeNotFirst_StillDeserializes()
    {
        // jsonb stores object keys sorted, so "type" is no longer the first key of a heir.
        var root = JsonNode.Parse(Snapshot())!.AsObject();
        foreach (var heirInfo in root["heirs"]!.AsArray())
        {
            if (heirInfo!["heirV2"] is JsonObject heir && heir["type"] is { } type)
            {
                heir.Remove("type");
                heir.Add("type", type.GetValue<string>());
            }
        }

        var model = OedModelJson.Deserialize(root.ToJsonString());

        AssertSnapshotModel(model);
    }

    [Fact]
    public void Deserialize_JsonNull_Throws()
    {
        Assert.Throws<JsonException>(() => OedModelJson.Deserialize("null"));
    }

    private static void AssertSnapshotModel(OedInstanceData model)
    {
        Assert.Equal("26-000123TVA-OSLO", model.CaseNumber);
        Assert.Equal("01015012345", model.DeceasedInfo.Deceased.Nin);

        Assert.Equal(
            [typeof(PersonHeirV2), typeof(PersonHeir), typeof(OrganizationHeir), typeof(PappPersonHeir), typeof(PappOrganizationHeir), null],
            model.Heirs.Select(h => h.HeirV2?.GetType()));

        Assert.Equal("urn:domstolene:digitaltdodsbo:formuesfullmakt", ((PersonHeirV2)model.Heirs[0].HeirV2).CourtRole);
        Assert.Equal("1980-02-03", ((PersonHeirV2)model.Heirs[0].HeirV2).Birthday);
        Assert.Equal(50033333, model.Heirs[^1].Heir.PartyId);
        Assert.Equal(StatusNotificationType.OpenApp, model.StatusNotifications[0].StatusNotificationType);
        Assert.Equal(DateTimeOffset.Parse("2026-01-05T12:00:00+02:00"), model.FirstHeirReceivedDate);
    }
}
