namespace oed_admin.Server.Features.Estate.GetRoleAssignmentLog;

public record Request(Guid EstateId)
{
    public bool IsValid()
    {
        return EstateId != default && EstateId != Guid.Empty;
    }
}