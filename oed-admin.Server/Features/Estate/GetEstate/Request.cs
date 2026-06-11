namespace oed_admin.Server.Features.Estate.GetEstate;

public record Request(Guid EstateId)
{
    public bool IsValid() => EstateId != Guid.Empty;
}