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
        services.Configure<AltinnSettings>(configuration.GetSection("AltinnSettings"));

        var maskinportenSettings = configuration.GetRequiredSection("MaskinportenSettings").Get<MaskinportenSettings>();

        services
            .AddMaskinportenHttpClient<SettingsJwkClientDefinition, IAltinnClient, AltinnClient>(
                maskinportenSettings! with
                {
                    Scope = "altinn:serviceowner/instances.read altinn:serviceowner/instances.write altinn:events.publish altinn:events.subscribe"
                },
                clientDefinition =>
                {
                    clientDefinition.ClientSettings.ExhangeToAltinnToken = true;
                    clientDefinition.ClientSettings.EnableDebugLogging = true;
                })
            .ConfigureHttpClient((provider, client) =>
            {
                var settings = provider.GetRequiredService<IOptionsMonitor<AltinnSettings>>();
                client.BaseAddress = new Uri(settings.CurrentValue.PlatformUrl);
            });

        services
            .AddMaskinportenHttpClient<SettingsJwkClientDefinition, IOedClient, OedClient>(
                maskinportenSettings with
                {
                    Scope = "digdir:dd:probatedeclarations"
                },
                clientDefinition =>
                {
                    clientDefinition.ClientSettings.ExhangeToAltinnToken = false;
                    clientDefinition.ClientSettings.EnableDebugLogging = true;
                })
            .ConfigureHttpClient((provider, client) =>
            {
                var settings = provider.GetRequiredService<IOptionsMonitor<AltinnSettings>>();
                client.BaseAddress = new Uri(settings.CurrentValue.AppsUrl);
            });

        return services;
    }
}