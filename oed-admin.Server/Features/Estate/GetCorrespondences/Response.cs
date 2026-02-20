using Altinn.Dd.Correspondence.Features.Get;

namespace oed_admin.Server.Features.Estate.GetCorrespondences;

public record Response(List<CorrespondenceOverview> Correspondences);
