namespace oed_admin.Features.Instance.GetInstanceData;

public record Request(int InstanceOwnerPartyId, Guid InstanceGuid, Guid DataGuid)
{
    public bool IsValid()
    {
        if (InstanceOwnerPartyId <= 0) 
            return false;

        if (InstanceGuid == default || InstanceGuid == Guid.Empty) 
            return false;

        if (DataGuid == default || DataGuid == Guid.Empty)
            return false;

        return true;
    }
}