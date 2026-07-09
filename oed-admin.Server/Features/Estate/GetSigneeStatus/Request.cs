namespace oed_admin.Server.Features.Estate.GetSigneeStatus;

public record Request(Guid EstateId)
{
    public bool IsValid() => EstateId != Guid.Empty;
}