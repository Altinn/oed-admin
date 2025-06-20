using System.Text.Json.Serialization;

namespace oed_admin.Server.Infrastructure.EasyAuth;

public class EasyAuthPrincipal
{
    [JsonPropertyName("auth_typ")]
    public string AuthenticationType { get; set; }
    [JsonPropertyName("claims")]
    public IEnumerable<EasyAuthClaim> Claims { get; set; }
    [JsonPropertyName("name_typ")]
    public string NameType { get; set; }
    [JsonPropertyName("role_typ")]
    public string RoleType { get; set; }
}