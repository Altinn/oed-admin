using Altinn.ApiClients.Maskinporten.Config;
using Altinn.ApiClients.Maskinporten.Extensions;
using Altinn.ApiClients.Maskinporten.Services;
using Microsoft.Extensions.Options;
using oed_testdata.Server.Infrastructure.Altinn;

namespace oed_admin.Server.Infrastructure.Altinn;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAltinnClients(
        this IServiceCollection services, 
        IConfiguration configuration)
    {
        var maskinportenSettings = new MaskinportenSettings();
        configuration.GetSection("MaskinportenSettings").Bind(maskinportenSettings);

        services.Configure<AltinnSettings>(configuration.GetSection("AltinnSettings"));

        services
            .AddMaskinportenHttpClient<SettingsJwkClientDefinition, IAltinnClient, AltinnClient>(
                maskinportenSettings,
                clientDefinition =>
                {
                    clientDefinition.ClientSettings.Scope =
                        "altinn:serviceowner/instances.read altinn:serviceowner/instances.write altinn:events.publish altinn:events.subscribe";
                    clientDefinition.ClientSettings.ExhangeToAltinnToken = true;
                    clientDefinition.ClientSettings.EnableDebugLogging = true;
                })
            .ConfigureHttpClient((provider, client) =>
            {
                var settings = provider.GetRequiredService<IOptionsMonitor<AltinnSettings>>();
                client.BaseAddress = new Uri(settings.CurrentValue.PlatformUrl);
            });

        return services;
    }
}