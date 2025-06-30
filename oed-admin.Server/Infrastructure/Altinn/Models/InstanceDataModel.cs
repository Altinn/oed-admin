#nullable disable

namespace oed_admin.Server.Infrastructure.Altinn.Models;

public class InstanceDataModel<T>
{
    public Guid DataId { get; set; }

    public T Data { get; set; }
}