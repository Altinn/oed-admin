namespace oed_admin.Server.Infrastructure.OedModel;

public static class ServiceCollectionExtensions
{
    /// <summary>Scoped, like the <see cref="Database.Oed.OedDbContext"/> it reads.</summary>
    public static IServiceCollection AddOedModelSource(this IServiceCollection services) =>
        services.AddScoped<IOedModelSource, OedModelSource>();
}
