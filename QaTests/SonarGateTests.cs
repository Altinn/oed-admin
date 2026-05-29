using Altinn.Dd.Tests.SonarGate;
using Xunit;
using Xunit.Abstractions;

namespace QaTests;

// Opt-in SonarQube quality-gate test for the oed-admin.Server project. The actual runner lives in
// the Altinn.Dd.Tests.SonarGate package — this file is just the option blob. See
// https://altinn.studio/repos/digdir/dd-qa for the package source and a description of each option.
//
// No coverage step (oed-admin has no .NET test project yet); once one exists, add a CoverageOptions
// pointing at it and the gate will start evaluating coverage on new code.
//
// Run with:  $env:QATESTS = "1"; dotnet test ./QaTests/QaTests.csproj
public class SonarGateTests(ITestOutputHelper output)
{
    [SkippableFact, Trait("Category", "qa")]
    public Task QualityGate_ReturnsOk() => SonarGate.RunAsync(new()
    {
        ProjectKey = "oed-admin",
        ScanCsprojRelativePath = "oed-admin.Server/oed-admin.Server.csproj",
        // Exclude the Vite SPA frontend and bundled web assets so the SonarJS bridge doesn't fire.
        SonarExclusions =
            "**/*.js,**/*.jsx,**/*.ts,**/*.tsx,**/*.css,**/*.scss,**/*.html," +
            "**/wwwroot/**,**/oed-admin.client/**,**/node_modules/**",
        DdQa = new() { ProjectFolder = "oed-admin" },
    }, output);
}
