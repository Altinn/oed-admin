using Altinn.Dd.Correspondence.Features.Get;

namespace oed_admin.Server.Features.Estate.GetCorrespondences;

public record CorrespondenceResult(
    Guid CorrespondenceId,
    bool IsSuccess,
    CorrespondenceOverview? Correspondence,
    string? ErrorMessage)
{
    public static CorrespondenceResult Success(Guid correspondenceId, CorrespondenceOverview correspondence) =>
        new(correspondenceId, true, correspondence, null);

    public static CorrespondenceResult Failure(Guid correspondenceId, string? errorMessage = null) =>
        new(correspondenceId, false, null, errorMessage);
}

public record Response(List<CorrespondenceResult> Correspondences);     
