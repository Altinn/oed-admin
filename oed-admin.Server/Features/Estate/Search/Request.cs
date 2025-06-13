namespace oed_admin.Features.Estate.Search;

public record Request(string? Nin, int? PartyId, string? Name, int? Page, int? PageSize)
{
    public bool IsValid()
    {
        if (string.IsNullOrWhiteSpace(Nin) && PartyId is null && string.IsNullOrWhiteSpace(Name))
        {
            // No search params
            return false;
        }

        if (!string.IsNullOrWhiteSpace(Nin))
        {
            if (Nin is not { Length: 11 } || !Nin.All(char.IsDigit))
            {
                return false;
            }
        }

        if (PartyId is not null and not >= 0)
        {
            return false;
        }

        if (Page is not null and not > 0)
        {
            return false;
        }

        if (PageSize is not null and not > 0)
        {
            return false;
        }


        return true;
    }
}