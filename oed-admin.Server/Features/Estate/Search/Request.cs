namespace oed_admin.Server.Features.Estate.Search;

public record Request(string? Nin, string? HeirNin, int? PartyId, string? Name, string? CaseNumber, string? CaseId)
{
    public bool IsValid()
    {
        if (string.IsNullOrWhiteSpace(Nin) &&
            string.IsNullOrWhiteSpace(HeirNin) &&
            PartyId is null &&
            string.IsNullOrWhiteSpace(Name) &&
            string.IsNullOrWhiteSpace(CaseNumber) &&
            string.IsNullOrWhiteSpace(CaseId))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(Nin) && !IsValidNin(Nin)) return false;
        if (!string.IsNullOrWhiteSpace(HeirNin) && !IsValidNin(HeirNin)) return false;
        if (PartyId is < 0) return false;

        return true;
    }

    private static bool IsValidNin(string nin) =>
        nin is { Length: 6 or 11 } && nin.All(char.IsDigit);
}
