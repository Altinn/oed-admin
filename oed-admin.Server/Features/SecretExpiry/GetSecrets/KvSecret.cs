namespace oed_admin.Server.Features.SecretExpiry.GetSecrets
{
    public record KvSecret(string vaultName, string Name, DateTimeOffset? created, DateTimeOffset? ValidFrom, DateTimeOffset? Expires);
}