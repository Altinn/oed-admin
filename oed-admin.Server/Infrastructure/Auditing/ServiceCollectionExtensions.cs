using oed_admin.Server.Infrastructure.Auditing.Loggers;

namespace oed_admin.Server.Infrastructure.Auditing;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAuditLogging(
        this IServiceCollection services, 
        IHostEnvironment env)
    {
        return env.IsDevelopment() 
            ? services.AddTransient<IAuditLogger, LogAuditLogger>()
            : services.AddTransient<IAuditLogger, NullLogger>();
    }
}