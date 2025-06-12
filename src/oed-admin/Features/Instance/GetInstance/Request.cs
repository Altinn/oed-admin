namespace oed_admin.Features.Instance.GetInstance;

public record Request(int InstanceOwnerPartyId, Guid InstanceGuid)
{
    public bool IsValid()
    {
        if (InstanceOwnerPartyId <= 0) 
            return false;

        if (InstanceGuid == default || InstanceGuid == Guid.Empty) 
            return false;

        return true;
    }
}