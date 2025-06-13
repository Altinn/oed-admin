namespace oed_admin.Server.Infrastructure.Mapping;

public static class PoorMansMapper
{
    public static TTo? Map<TFrom, TTo>(TFrom from) where TTo : class
    {
        var fromType = typeof(TFrom);
        var toType = typeof(TTo);

        var instance = Activator.CreateInstance(toType);
            
        var properties = toType.GetProperties();
        foreach (var property in properties)
        {
            var fromProp = fromType.GetProperty(property.Name);
            if (fromProp is not null)
            {
                property.SetValue(instance, fromProp.GetValue(from));
            }
        }

        return instance as TTo;
    }
}