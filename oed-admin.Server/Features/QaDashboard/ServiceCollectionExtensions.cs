namespace oed_admin.Server.Features.QaDashboard;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddQaDashboard(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var storageAccount = configuration["QaDashboard:StorageAccount"] ?? "oedqa";
        var container = configuration["QaDashboard:Container"] ?? "reports";

        services.AddSingleton(new QaReportsReader(storageAccount, container));

        return services;
    }
}
