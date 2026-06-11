namespace oed_admin.Server.Features.Debug.ExceptionRaiser;

public static class Endpoint
{
    public static async Task<IResult> Get()
    {
        throw new InvalidOperationException("Test exception");
    }
}
