using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.AspNetCore.Mvc;
using oed_admin.Server.Infrastructure.Database.Authz;

namespace oed_admin.Server.Features.SecretExpiry.Get
{
    public class Endpoint
    {        
        public static async Task<IResult> Get()
        {
            try
            {
                var secretList = new List<KvSecret>();

                var keyVaultUrl = new Uri("https://<ditt-keyvault-navn>.vault.azure.net/");
                var client = new SecretClient(keyVaultUrl, new DefaultAzureCredential());

                await foreach (var secretProperties in client.GetPropertiesOfSecretsAsync())
                {
                    KeyVaultSecret secret = await client.GetSecretAsync(secretProperties.Name);
                    secretList.Add(new KvSecret(secret.Name}");
                    Console.WriteLine($"Verdi: {secret.Value}");
                    Console.WriteLine($"Versjon: {secret.Properties.Version}");
                    Console.WriteLine($"Opprettet: {secret.Properties.CreatedOn}");
                    Console.WriteLine($"Sist oppdatert: {secret.Properties.UpdatedOn}");
                    Console.WriteLine($"Gyldig fra: {secret.Properties.NotBefore}");
                    Console.WriteLine($"Utløper: {secret.Properties.ExpiresOn}");
                    Console.WriteLine(new string('-', 40));
                }

            }
            catch (Exception)
            {

                throw;
            }
            

        }
    }
}
