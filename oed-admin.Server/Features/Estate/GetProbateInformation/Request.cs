namespace oed_admin.Server.Features.Estate.GetProbateInformation;

public record Request(Guid EstateId)
{
    public bool IsValid() => EstateId != Guid.Empty;
}