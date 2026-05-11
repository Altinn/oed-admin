using oed_admin.Server.Infrastructure.Database.Oed.Model;

namespace oed_admin.Server.Features.Estate.SyncDaCase;

public record Request(Guid EstateId)
{
    public bool IsValid()
    {
        if (EstateId == default || EstateId == Guid.Empty)
            return false;

        return true;
    }
}