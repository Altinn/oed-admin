using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Database.Authz;

namespace oed_admin.Server.Features.SecretExpiry.Get
{
    public class Endpoint
    {        
        public static async Task<IResult> Get([FromServices] ILogger<Endpoint> log)
        {
            try
            {
                var secrets1 = await GetSecretsFromVault("https://oed-kv.vault.azure.net/");

                var secrets2 = await GetSecretsFromVault("https://digdir-tt02-apps-kv.vault.azure.net/");

                secrets1.AddRange(secrets2);
                var allSecrets = secrets1.Where(x => x.Expires.HasValue);
                var orderedList = allSecrets.OrderBy(x => x.Expires).ToList();

                var result = TypedResults.Ok(new Response() { Secrets = orderedList });
                return result;

            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error in SecretExpiry.Get");
                return TypedResults.InternalServerError(ex);
            }
            

        }

        private static async Task<List<KvSecret>> GetSecretsFromVault(string vaultUrl)
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
    }
}
