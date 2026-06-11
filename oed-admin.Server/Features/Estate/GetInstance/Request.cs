namespace oed_admin.Server.Features.Estate.GetInstance;

public record Request(Guid EstateId)
{
    public bool IsValid() => EstateId != Guid.Empty;
}