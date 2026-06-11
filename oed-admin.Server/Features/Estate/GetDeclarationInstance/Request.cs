namespace oed_admin.Server.Features.Estate.GetDeclarationInstance;

public record Request(Guid EstateId)
{
    public bool IsValid() => EstateId != Guid.Empty;
}