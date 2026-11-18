using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using oed_admin.Server.Infrastructure.DataMigration.Models.Oed;

namespace oed_admin.Server.Infrastructure.OedModel;

/// <summary>
/// Reads <c>oed.estate_model.model</c> into <see cref="OedInstanceData"/>, with the options oed writes it with.
/// </summary>
/// <remarks>
/// The options are copied from digdir/oed <c>App/Infrastructure/OedModel/OedModelJson.cs</c> (commit b6efb99b),
/// not guessed. The stored shape is pinned by oed's snapshot
/// <c>ApiTest/ContractSnapshots/oed_model_storage_contract.json</c>, and <c>OedModelJsonContractTests</c> reads a
/// copy of it. Keep the two in step when oed changes either.
/// </remarks>
public static class OedModelJson
{
    public static JsonSerializerOptions Options { get; } = CreateOptions();

    public static OedInstanceData Deserialize(string json) =>
        JsonSerializer.Deserialize<OedInstanceData>(json, Options)
        ?? throw new JsonException("The stored OED_M is the JSON literal null");

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions
        {
            // jsonb stores object keys sorted (shorter keys first), so a polymorphic object's "type" discriminator is
            // no longer first when it comes back, and by default System.Text.Json refuses to read it.
            AllowOutOfOrderMetadataProperties = true,

            // Every OED_M property has [JsonPropertyName]; StatusNotification has none, so this decides its keys
            // (partyID, timestamp, statusNotificationType).
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = false,

            // Absent rather than null: smaller rows, and model->>'x' is NULL either way.
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,

            // The model's only enum, StatusNotificationType, as a string.
            Converters = { new JsonStringEnumConverter(namingPolicy: null, allowIntegerValues: false) },

            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,

            NumberHandling = JsonNumberHandling.Strict,
            ReadCommentHandling = JsonCommentHandling.Disallow,
            AllowTrailingCommas = false,
            // oed-admin's copy of the model has fewer properties than oed's (no probateResultV2, chosenProbateTypes,
            // ...); those keys are skipped.
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Skip,
            UnknownTypeHandling = JsonUnknownTypeHandling.JsonElement,
            WriteIndented = false,
            TypeInfoResolver = new DefaultJsonTypeInfoResolver(),
        };

        options.MakeReadOnly();
        return options;
    }
}
