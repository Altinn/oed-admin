namespace oed_admin.Features.Estate.GetRoleAssignments;

public record Request(Guid EstateId)
{
    public bool IsValid()
    {
        return EstateId != default && EstateId != Guid.Empty;
    }
}