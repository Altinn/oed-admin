using System.Text.Json.Serialization;

namespace oed_admin.Server.Infrastructure.EasyAuth;

public class EasyAuthPrincipal
{
    [JsonPropertyName("auth_typ")]
    public required string AuthenticationType { get; set; }
    [JsonPropertyName("claims")]
    public required IEnumerable<EasyAuthClaim> Claims { get; set; }
    [JsonPropertyName("name_typ")]
    public required string NameType { get; set; }
    [JsonPropertyName("role_typ")]
    public required string RoleType { get; set; }
}