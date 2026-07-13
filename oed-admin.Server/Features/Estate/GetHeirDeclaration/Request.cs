namespace oed_admin.Server.Features.Estate.GetHeirDeclaration;

public record Request(Guid EstateId, int HeirPartyId, string SubApp, Guid HeirInstanceId)
{
    public bool IsValid() =>
        EstateId != Guid.Empty &&
        HeirPartyId > 0 &&
        !string.IsNullOrWhiteSpace(SubApp) &&
        HeirInstanceId != Guid.Empty;
}
