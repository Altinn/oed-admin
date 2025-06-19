namespace oed_admin.Server.Features.Estate.GetEvents;

public record Request(Guid EstateId, int? PageSize, string? LastRetrievedEventId)
{
    public bool IsValid()
    {
        if (EstateId == default || EstateId == Guid.Empty)
            return false;

        if (LastRetrievedEventId is not null and not {Length: > 0})
            return false;

        if (PageSize is not null and not > 0)
            return false;

        return true;
    }
}