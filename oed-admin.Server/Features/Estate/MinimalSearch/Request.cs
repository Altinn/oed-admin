namespace oed_admin.Server.Features.Estate.MinimalSearch;

public record Request(string Nin)
{
    public bool IsValid()
    {
        if (string.IsNullOrWhiteSpace(Nin))
        {
            // No search params
            return false;
        }

        if (!string.IsNullOrWhiteSpace(Nin))
        {
            if (Nin is not { Length: 6 or 11 } ||
                !Nin.All(char.IsDigit))
            {
                return false;
            }
        }

        return true;
    }
}