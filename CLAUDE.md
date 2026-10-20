# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Internal admin application for **Digitalt Dødsbo** (Norwegian digital estate settlement). An ASP.NET Core 10 minimal-API backend (`oed-admin.Server`) serving a React 19 + Vite SPA (`oed-admin.client`). Staff use it to look up estates, inspect Altinn instances/events, manage the task queue, and grant/revoke superadmin role assignments.

The app is a **read-mostly window onto other systems' data**. It attaches to the existing `oed` and `oedauthz` PostgreSQL databases owned by other services, and calls Altinn/OED HTTP APIs. There are no EF Core migrations here — never add one; schema changes belong in the owning repository.

## Commands

Run from repo root unless noted.

```powershell
dotnet build                                    # server + QaTests only — does NOT build the SPA
dotnet run --project oed-admin.Server           # default 'http' profile: http://localhost:5199
dotnet run --project oed-admin.Server -lp https # https://localhost:7156
```

Either profile auto-launches Vite via SpaProxy; develop against the Vite URL, not the backend URL.

Client-only (from `oed-admin.client/`):

```powershell
npm ci             # install from the lockfile
npm run dev        # Vite on https://localhost:60475, proxies ^/api to the backend
npm run build      # tsc -b && vite build
npm run lint       # eslint .
```

The client needs `VITE_CLIENT_ID` (Entra ID app registration) and `VITE_ENVIRONMENT` at build/dev time; CI supplies both at `dotnet publish`.

**Nothing type-checks the SPA during normal development.** The esproj sets `ShouldRunBuildScript=false`, so `dotnet build` (and Visual Studio's Build) never runs `npm run build`; Vite's dev server transpiles TypeScript with esbuild, which strips types without checking them. `tsc` runs only via `npm run build` or `dotnet publish` — the latter *does* invoke `npm run build`, even with `--no-build`. A stale `node_modules` can therefore diverge from `package-lock.json` for a long time without any local symptom, then surface as a type error at publish. Run `npm ci` before trusting a `tsc` failure.

### Tests

There is **no unit test project**. `QaTests` is a single opt-in SonarQube quality-gate runner, skipped unless `QATESTS=1`:

```powershell
$env:QATESTS = "1"; dotnet test ./QaTests/QaTests.csproj
```

It runs nightly via `.github/workflows/qa.yml` and needs `AZURE_STORAGE_SAS_TOKEN`. Plain `dotnet test` (as CI/CD runs it) skips everything. If you add a real .NET test project, wire a `CoverageOptions` into `QaTests/SonarGateTests.cs` so the gate starts evaluating coverage.

## Architecture

### Vertical slice features

Every endpoint lives in `oed-admin.Server/Features/<Area>/<Operation>/` as a static `Endpoint` class plus `Request`/`Response` records in the same folder. Endpoints take dependencies via `[FromServices]` — there is no service/repository layer, and handlers query `OedDbContext`/`AuthzDbContext` directly with `.AsNoTracking()`.

All routes are wired centrally in `Features/Endpoints.cs` (`MapFeatureEndpoints`), which is also where authorization is applied per group. **A new feature folder does nothing until it is registered there.**

`Request` records expose a hand-rolled `IsValid()` that the endpoint calls first, returning `TypedResults.BadRequest()`. There is no FluentValidation or model-binding validation. Entity→DTO projection uses `Infrastructure/Mapping/PoorMansMapper` (reflection, name-matched properties).

### Authorization

Two policies, both defined in `Infrastructure/Authz`: `AtLeastReadRole` (roles `Read` or `Admin`) and `RequireAdminRole` (`Admin` only). Almost everything is admin-only; `Read` users get just estate `minimalsearch` and district courts, and the SPA routes them to a restricted UI (`RestrictedHome`). Roles come from Entra ID app roles in the JWT.

Auth is Entra ID JWT bearer end to end: MSAL in the browser (`src/msal.ts`), validated by `AddJwtBearer` on the server. The `EasyAuth` and `DevAuth` folders under `Infrastructure/` are vestigial — `AddAuth` does not wire them up.

`/api/qa` is deliberately unauthenticated (QA dashboard, read from a public-ish blob container).

### Audit logging

`AuditingLoggingMiddleware` wraps every request with an endpoint and writes an `AuditLogRecord` (user object id, name, roles, request body, response status, affected estate ids) to Azure Table Storage — or to `ILogger` in Development. For POST search endpoints it buffers the response body to extract estate ids, because they aren't in the route. This is a compliance requirement: personal data lookups must be traceable. Don't bypass it, and be careful adding endpoints that return estates without an `estateId` route value.

### Outbound clients

`Infrastructure/Altinn/ServiceCollectionExtensions.cs` registers four typed HTTP clients, each with its own Maskinporten scope: `IAltinnClient` (Platform), `IOedClient` (apps), `IOedAuthzClient`, `IOedEventsClient`. In Development against `http://localhost` the Altinn client swaps Maskinporten for `LocalTestTokenHandler`. Adding an outbound call generally means picking the right existing client rather than a new `HttpClient`.

### Data migration

`InstanceToDbDataMigration` is a `BackgroundService` fed by an unbounded `Channel<DataMigrationTrigger>`; `POST /api/maintenance/datamigration` writes a trigger to the channel. Note that `AddDataMigrationService()` is **not** currently called from `Program.cs`, so the channel is unregistered and that endpoint fails at request time until it is.

### Client

React Router with role-gated route trees in `App.tsx`. Data fetching is TanStack Query; every call goes through `utils/msalUtils.ts#fetchWithMsal`, which silently acquires an access token and sets the bearer header — use it rather than bare `fetch`. Query key factories live in `src/queries/`. UI is Digdir Designsystemet (`@digdir/designsystemet-react`); user-facing text is Norwegian.

## Deployment

Push to `main` triggers `.github/workflows/CI-CD-admin-app.yml`: build → `dotnet test` → publish → Azure App Service (test), then production behind a manual approval gate. Dependencies are managed by Renovate against Altinn's shared config.

## Project tooling

Checked in under `.claude/`:

- **`/new-endpoint`** — scaffolds a vertical slice and registers it in `Features/Endpoints.cs` with an authorization policy. Bundles a template drawn from `Features/Estate/GetEstate/`.
- **`/setup-dev`** — local environment setup (dev certificates, the two databases, user secrets, `VITE_CLIENT_ID`). Its `scripts/check-prereqs.ps1` reports what is missing without changing anything.
- **`security-reviewer`** subagent — audits a diff for missing authorization policies, personal-data exposure through `PoorMansMapper`, and endpoints the audit middleware cannot extract an estate id from.
- **`sonar-preflight`** subagent — predicts SonarQube findings on a diff before the nightly gate does. Server C# only; the SPA is excluded from the scan.
- Two `PostToolUse` hooks in `.claude/hooks/`: eslint on edited client sources, and a reminder when a new `Features/**/Endpoint.cs` is not yet registered. Both need Git Bash and Node on `PATH`.
