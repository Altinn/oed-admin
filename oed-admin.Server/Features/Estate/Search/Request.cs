namespace oed_admin.Server.Features.Estate.Search;

public record Request(string? Nin, string? HeirNin, int? PartyId, string? Name, string? CaseNumber, int? Page, int? PageSize)
{
    public bool IsValid()
    {
        if (string.IsNullOrWhiteSpace(Nin) &&
            string.IsNullOrWhiteSpace(HeirNin) && 
            PartyId is null && 
            string.IsNullOrWhiteSpace(Name) && 
            string.IsNullOrWhiteSpace(CaseNumber))
        {
            // No search params
            return false;
        }

        if (!string.IsNullOrWhiteSpace(Nin))
        {
            if (Nin is not { Length: 6 or 11} || 
                !Nin.All(char.IsDigit))
            {
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(HeirNin))
        {
            if (HeirNin is not { Length: 6 or 11 } ||
                !HeirNin.All(char.IsDigit))
            {
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(Name))
        {
            if (Name is not { Length: > 0 })
            {
                return false;
            }
        }

        if (!string.IsNullOrWhiteSpace(CaseNumber))
        {
            if (CaseNumber is not { Length: > 0 })
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