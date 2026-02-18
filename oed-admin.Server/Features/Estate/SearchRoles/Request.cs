namespace oed_admin.Server.Features.Estate.SearchRoles;

public record Request(Guid EstateId)
{
    public bool IsValid()
    {
        if (EstateId == default || EstateId == Guid.Empty)
            return false;

        return true;
    }
}