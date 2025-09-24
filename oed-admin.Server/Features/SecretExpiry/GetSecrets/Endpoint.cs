using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace oed_admin.Server.Features.SecretExpiry.GetSecrets
{
    public class Endpoint
    {
        private static ILogger<Endpoint> logger;

        public static async Task<IResult> Get(
            [FromServices] ILogger<Endpoint> log,
            [FromServices] IOptions<KeyVaultOptions> options)
        {
            try
            {
                logger = log;
                var secretList = new List<KvSecret>();

                foreach(var vault in options.Value)
                {
                    var secrets = await GetSecretsFromVault(vault.Value);
                    secretList.AddRange(secrets);
                }
                var allSecrets = secretList.Where(x => x.Expires.HasValue);
                var orderedList = allSecrets.OrderBy(x => x.Expires).ToList();

                var result = TypedResults.Ok(orderedList);
                return result;

            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error in SecretExpiry.Get");
                return TypedResults.InternalServerError(ex);
            }
            

        }

        private static async Task<List<KvSecret>> GetSecretsFromVault(string vaultUrl)
        {
            try
            {
                var keyVaultUrl = new Uri(vaultUrl);
                var client = new SecretClient(keyVaultUrl, new DefaultAzureCredential());

                var secretList = new List<KvSecret>();

                await foreach (var secretProperties in client.GetPropertiesOfSecretsAsync())
                {
                    if (secretProperties.Enabled.HasValue && secretProperties.Enabled.Value)
                    {
                        KeyVaultSecret secret = await client.GetSecretAsync(secretProperties.Name);
                        secretList.Add(new KvSecret(
                            vaultUrl,
                            secret.Name,
                            secret.Properties.CreatedOn,
                            secret.Properties.NotBefore,
                            secret.Properties.ExpiresOn));
                    }
                }

                return secretList;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, $"Failed to access KeyVault - '{vaultUrl}'");
                return new List<KvSecret>();
            }            
        }
    }
}
