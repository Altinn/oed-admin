using Altinn.ApiClients.Maskinporten.Interfaces;

namespace oed_admin.Server.Infrastructure.Altinn;

public record MaskinportenSettings : IMaskinportenSettings
{
    public string? ClientId { get; set; }
    public string? Scope { get; set; }
    public string? Resource { get; set; }
    public string? Environment { get; set; }
    public string? CertificatePkcs12Path { get; set; }
    public string? CertificatePkcs12Password { get; set; }
    public string? CertificateStoreThumbprint { get; set; }
    public string? EncodedJwk { get; set; }
    public string? EncodedX509 { get; set; }
    public string? ConsumerOrgNo { get; set; }
    public string? EnterpriseUserName { get; set; }
    public string? EnterpriseUserPassword { get; set; }
    public bool? ExhangeToAltinnToken { get; set; }
    public string? TokenExchangeEnvironment { get; set; }
    public bool? UseAltinnTestOrg { get; set; }
    public bool? EnableDebugLogging { get; set; }
    public bool? OverwriteAuthorizationHeader { get; set; }
}