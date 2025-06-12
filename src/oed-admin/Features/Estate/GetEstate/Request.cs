namespace oed_admin.Features.Estate.GetEstate;

public record Request(Guid Id)
{
    public bool IsValid()
    {
        return Id != default && Id != Guid.Empty;
    }
}