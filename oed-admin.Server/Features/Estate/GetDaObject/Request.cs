namespace oed_admin.Server.Features.Estate.GetDaObject;

public record Request(Guid CaseId)
{
    public bool IsValid()
    {
        if (CaseId == default || CaseId == Guid.Empty)
            return false;

        return true;
    }
}