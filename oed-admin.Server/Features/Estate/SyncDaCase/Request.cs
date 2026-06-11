namespace oed_admin.Server.Features.Estate.SyncDaCase;

public record Request(Guid EstateId)
{
    public bool IsValid() => EstateId != Guid.Empty;
}