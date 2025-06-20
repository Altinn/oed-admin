using System.Text.Json.Serialization;

namespace oed_admin.Server.Infrastructure.EasyAuth;

public class EasyAuthClaim
{
    [JsonPropertyName("typ")]
    public string Type { get; set; }
    [JsonPropertyName("val")]
    public string Value { get; set; }
}

public static class EasyAuthClaims
{
    public const string Groups = "groups";
}