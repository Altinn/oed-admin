using System.Net;
using System.Text;

namespace oed_admin.Server.Tests.OedModelAdmin;

/// <summary>A fake oed: answers every request with one canned response, and remembers the last request.</summary>
public sealed class StubHandler : HttpMessageHandler
{
    private Func<HttpResponseMessage>? _respond;

    public HttpRequestMessage? Request { get; private set; }
    public string? RequestBody { get; private set; }
    public int Calls { get; private set; }

    public void Respond(HttpStatusCode status, string body, Action<HttpResponseMessage>? configure = null) =>
        _respond = () =>
        {
            var response = new HttpResponseMessage(status)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };
            configure?.Invoke(response);
            return response;
        };

    public void Throw(Exception exception) => _respond = () => throw exception;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        Request = request;
        RequestBody = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        return _respond!();
    }
}
