namespace oed_admin.Server.Features.Estate.GetProbateInformation;

public record Request(Guid EstateId, int Version = 1)
{
    public bool IsValid()
    {
        if (EstateId == default || EstateId == Guid.Empty)
            return false;

        return true;
    }
}