namespace oed_admin.Server.Features.Estate.GetProbateInformation;

public record Request(Guid EstateId, int Version = 1)
{
    public bool IsValid() => EstateId != Guid.Empty;
}