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
// Run with:  $env:QATESTS = "1"; dotnet test ./QaTests
public class DependencyGateTests(ITestOutputHelper output)
{
    [SkippableFact, Trait("Category", "qa")]
    public Task Dependencies_HaveNoHighOrCriticalAdvisories() =>
        DependencyGate.RunAsync(new() { ProjectKey = "oed-admin" }, output);
}
