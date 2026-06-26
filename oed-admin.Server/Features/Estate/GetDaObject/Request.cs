namespace oed_admin.Server.Features.Estate.GetDaObject;

public record Request(Guid CaseId)
{
    public bool IsValid() => CaseId != Guid.Empty;
}