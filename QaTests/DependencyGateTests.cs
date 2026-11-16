using System.Threading.Tasks;
using Altinn.Dd.Tests.DependencyGate;
using Xunit;
using Xunit.Abstractions;

namespace QaTests;

// Opt-in dependency vulnerability gate. The runner lives in the
// Altinn.Dd.Tests.DependencyGate package - this file is just the option blob. See
// https://altinn.studio/repos/digdir/dd-qa for the package source.
//
// Audits every project in this repo, not just this one: a QaTests project does not reference the
// application projects, so its own dependency graph covers a fraction of the repo. Fails on any
// advisory at High or above, matching WarningsAsErrors=NU1903;NU1904 in Directory.Build.props, so
// the nightly gate and the build agree on what is unacceptable. Moderate and low are recorded in
// the snapshot without failing.
//
// The audit runs against oed-admin.deps.slnf, which lists only the PackageReference projects
// (oed-admin.Server and QaTests). Against oed-admin.sln, `dotnet list package` cannot evaluate
// oed-admin.client.esproj, and the gate skips the whole audit as incomplete. npm dependencies are
// not NuGet advisories and are out of scope here either way. Add any new .csproj to the filter.
//
// The gate also needs MSBUILDDISABLENODEREUSE=1 (set in qa.yml). Without it, the reused MSBuild
// node keeps the output pipe open and the gate waits until its 10-minute timeout, then skips.
//
// Run with:  $env:QATESTS = "1"; dotnet test ./QaTests
public class DependencyGateTests(ITestOutputHelper output)
{
    [SkippableFact, Trait("Category", "qa")]
    public Task Dependencies_HaveNoHighOrCriticalAdvisories() =>
        DependencyGate.RunAsync(new()
        {
            ProjectKey = "oed-admin",
            SolutionRelativePath = "oed-admin.deps.slnf",
        }, output);
}
