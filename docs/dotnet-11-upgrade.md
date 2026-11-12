# .NET 11 upgrade

Tracking issue: [Altinn/oed#1858](https://github.com/Altinn/oed/issues/1858). State as of 2026-11-24.

## Deploy order

A push to `main` deploys to test straight away, and to production after approval. The App Service
runtime is set in [dd-infrastructure](https://github.com/Altinn/dd-infrastructure)
(`azurerm_linux_web_app.admin_app` in `infra/*/web-app-admin.tf`, `dotnet_version = "10.0"`). The .NET 10
image only carries .NET 10, so a `net11.0` build exits at startup with code 150 (framework not found).

The runtime must be switched to .NET 11 in dd-infrastructure first, tt02 before prod, and this branch
merged right after each switch. Until the app is redeployed, the .NET 10 build runs on the .NET 11 image
and is expected not to start (not tested).

**Decision 2026-11-12:** wait for the `azurerm` provider to support .NET 11 rather than use a workaround.
azurerm 5.15.0 (2026-11-24) added it (hashicorp/terraform-provider-azurerm#33870).

Do not approve the oed-admin production deployment of this change until prod runs on the .NET 11 runtime.

## What this branch changes

- `oed-admin.Server`, `oed-admin.Server.Tests` and `QaTests` target `net11.0`.
- `Microsoft.AspNetCore.Authentication.JwtBearer`, `Microsoft.AspNetCore.OpenApi` and
  `Microsoft.AspNetCore.SpaProxy` 11.0.0. `Microsoft.OpenApi` moves from 2.x to 3.x transitively; the
  generated OpenAPI document is unchanged apart from the spec version (3.1.1 to 3.2.0).
- CI and the nightly QA workflow use `DOTNET_VERSION: "11.0.x"`.
- `CLAUDE.md`, `.github/copilot-instructions.md` and the `setup-dev` skill name .NET 11.

EF Core stays on 10.x: `Npgsql.EntityFrameworkCore.PostgreSQL` 11 is still a release candidate and
`EFCore.NamingConventions` has no 11.x. EF Core 10 runs on .NET 11. Both have had 11.0.0 releases since;
moving EF Core to 11 is a separate change.

## What we are waiting for

| Dependency | State 2026-11-24 | Watch |
|---|---|---|
| `azurerm` accepts `dotnet_version = "11.0"` for Linux web apps | Done: v5.15.0 | [hashicorp/terraform-provider-azurerm#33870](https://github.com/hashicorp/terraform-provider-azurerm/pull/33870) |
| dd-infrastructure on azurerm 5.x | tt02 on 5.15.0 (Altinn/dd-infrastructure#130); prod still pinned to 4.81.0 (#116) | — |
| App Service .NET 11 image in Norway East | Ready: `appsvc/dotnetcore:11.0_20261110.5` carries 11.0.0 GA, verified with a throwaway app | — |
| Npgsql EF Core provider 11 (optional) | 11.0.0 released, not adopted | NuGet |

## Finishing the upgrade

1. dd-infrastructure: bump azurerm to the pinned 5.x release that supports .NET 11 (tt02, then prod).
2. dd-infrastructure: set `dotnet_version = "11.0"` on the admin app in tt02. Check the plan touches only
   the runtime.
3. Rebase this branch on `main`, refresh the lock files (`dotnet restore --force-evaluate`), merge. It
   deploys to test; verify there.
4. dd-infrastructure: same runtime change in prod (needs approval). Approve the oed-admin production
   deployment immediately after the apply.

## Rejected for now: azapi workaround

Proven on a throwaway app on 2026-11-11, not used. Keep `dotnet_version = "10.0"`, add
`site_config[0].application_stack` to the web app's `ignore_changes`, and set the runtime with an
`azapi_update_resource` (`Microsoft.Web/sites@2024-04-01`, `properties.siteConfig.linuxFxVersion =
"dotnet|11"`). Downsides: a new provider to maintain, every later azurerm update of the web app rewrites the
runtime string and the next plan shows azapi setting it back, and deleting the azapi resource does not
revert the runtime.
