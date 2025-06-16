using Microsoft.AspNetCore.Mvc;

namespace oed_admin.Server.Features.Estate.GrantSuperadmin;

public record Request
{
    [FromRoute] public Guid EstateId { get; init; }
    [FromBody] public required Assignment Grant { get; init; }

    public bool IsValid()
    {
        if (EstateId == default || EstateId == Guid.Empty)
            return false;

        return Grant.IsValid();
    }

    public record Assignment(string Nin, string Justification)
    {
        public bool IsValid()
        {
            if (Nin is not { Length: 11 })
                return false;

            if (string.IsNullOrWhiteSpace(Justification))
                return false;

            return true;
        }
    }
}

