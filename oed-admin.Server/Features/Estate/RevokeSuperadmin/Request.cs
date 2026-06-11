using oed_admin.Server.Infrastructure.Database.Oed.Model;

namespace oed_admin.Server.Features.Estate.RevokeSuperadmin;

public record Request(Guid EstateId)
{
    public bool IsValid() => EstateId != Guid.Empty;
}