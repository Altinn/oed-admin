using Altinn.Dd.Correspondence.Features.Search;
using Altinn.Dd.Correspondence.Models;
using Altinn.Dd.Correspondence.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using oed_admin.Server.Infrastructure.Database.Oed;

namespace oed_admin.Server.Features.Estate.GetCorrespondences;

public static class Endpoint
{
    public static async Task<IResult> Get(
        [AsParameters] Request request,
        [FromServices] OedDbContext dbContext,
        [FromServices] IDdCorrespondenceService ddCorrespondenceService)
    {
        if (!request.IsValid())
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Invalid request",
                Detail = "The request payload is invalid.",
                Status = StatusCodes.Status400BadRequest
            });

        var estate = await dbContext.Estate
            .AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == request.EstateId);

        if (estate is null)
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Estate not found",
                Detail = "No estate was found for the provided id.",
                Status = StatusCodes.Status404NotFound
            });

        var query = new Query(
            ResourceId: "digdir-dd-correspondence", 
            Role: CorrespondencesRoleType.Sender, 
            SendersReference: estate.InstanceId);
        var searchResult = await ddCorrespondenceService.Search(query);

        if (searchResult.IsSuccess)
        {
            var correspondenceTasks = searchResult.Value!
                .Select(correspondenceId => GetCorrespondenceResult(correspondenceId, ddCorrespondenceService))
                .ToList();

            var correspondences = await Task.WhenAll(correspondenceTasks);

            return TypedResults.Ok(new Response([.. correspondences]));
        }
        else
        {
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Correspondence search failed",
                Detail = "Failed to search correspondences.",
                Status = StatusCodes.Status400BadRequest
            });
        }
    }

    private static async Task<CorrespondenceResult> GetCorrespondenceResult(
        Guid correspondenceId,
        IDdCorrespondenceService ddCorrespondenceService)
    {
        try
        {
            var getRequest = new Altinn.Dd.Correspondence.Features.Get.Request(correspondenceId);
            var result = await ddCorrespondenceService.Get(getRequest);

            return result.Match(
                success => CorrespondenceResult.Success(correspondenceId, success),
                failure => CorrespondenceResult.Failure(correspondenceId, failure.ToString()));
        }
        catch (Exception exception)
        {
            return CorrespondenceResult.Failure(correspondenceId, exception.Message);
        }
    }

}
