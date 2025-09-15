using oed_admin.Server.Infrastructure.Altinn;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Debug.ExceptionRaiser
{
    public class Endpoint
    {
        public static async Task<IResult> Get()
        {
            throw new Exception("Test exception");
        }
    }
}
