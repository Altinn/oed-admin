namespace oed_admin.Server.Features.SecretExpiry.Get
{
    public record KvSecret(string Name, DateTime created, DateTime? ValidFrom, DateTime? Expires);
}