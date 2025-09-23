namespace oed_admin.Server.Features.SecretExpiry.Get
{
    public record KvSecret(string vaultName, string Name, DateTimeOffset? created, DateTimeOffset? ValidFrom, DateTimeOffset? Expires);
}