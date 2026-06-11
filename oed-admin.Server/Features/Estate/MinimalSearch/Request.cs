namespace oed_admin.Server.Features.Estate.MinimalSearch;

public record Request(string Nin)
{
    public bool IsValid() =>
        Nin is { Length: 6 or 11 } && Nin.All(char.IsDigit);
}