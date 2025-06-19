namespace oed_admin.Server.Features.Instances.GetInstance;

public record Request(int InstanceOwnerPartyId, Guid InstanceGuid)
{
    public bool IsValid()
    {
        
        return true;
    }
}