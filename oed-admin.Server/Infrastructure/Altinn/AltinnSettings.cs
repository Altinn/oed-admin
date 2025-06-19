namespace oed_testdata.Server.Infrastructure.Altinn;

public class AltinnSettings
{
    public required string TokenGeneratorUrl { get; set; }
    public required string PlatformUrl { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
}