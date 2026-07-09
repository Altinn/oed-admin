namespace oed_admin.Server.Features.Instances.GetInstanceData;

public record Request(int InstanceOwnerPartyId, Guid InstanceGuid, Guid DataGuid)
{
    public bool IsValid() =>
        InstanceOwnerPartyId > 0 && InstanceGuid != Guid.Empty && DataGuid != Guid.Empty;
}