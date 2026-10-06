# Copilot instructions for oed-admin

## Repository overview

This repo contains a .NET 10 minimal API backend in `oed-admin.Server` and a React 19 + Vite SPA in `oed-admin.client`.

The app is a read-mostly admin UI for Digitalt Dødsbo: it reads from the existing `oed` and `oedauthz` PostgreSQL databases, calls Altinn/OED HTTP APIs, and exposes role-gated estate/task/instance operations to staff.

## Build, test, and lint commands

Run from the repo root unless noted.

```powershell
dotnet build
```

This builds the server project and QA gate project only; it does not build the SPA.

```powershell
dotnet run --project oed-admin.Server
# default http profile: http://localhost:5199

dotnet run --project oed-admin.Server -lp https
# https://localhost:7156
```

The backend auto-launches the Vite app through SPA proxy; work against the Vite dev URL rather than the backend URL directly.

```powershell
cd oed-admin.client
npm ci
npm run dev
npm run build
npm run lint
```

Notes:
- `npm run build` runs `tsc -b && vite build`.
- `npm run lint` runs ESLint across the client.
- The SPA is not type-checked during normal backend development because the project is configured to skip the frontend build step; use `npm run build` (or `dotnet publish`) when you need a real TypeScript check.

QA / quality-gate tests are opt-in and are not part of the default test command:

```powershell
$env:QATESTS = "1"; dotnet test ./QaTests/QaTests.csproj
```

Single-test pattern example:

```powershell
$env:QATESTS = "1"; dotnet test ./QaTests/QaTests.csproj --filter "FullyQualifiedName~QualityGate_ReturnsOk"
```

## High-level architecture

### Backend

- `Program.cs` wires authentication, auditing, database contexts, Altinn/OED clients, and feature mapping.
- `oed-admin.Server/Features/Endpoints.cs` is the central route registry. Feature groups are mapped here and authorization policies are attached there.
- Most endpoints live in vertical-slice folders using the pattern `oed-admin.Server/Features/<Area>/<Operation>/`.
- Each endpoint folder usually contains a static `Endpoint` plus `Request` and `Response` records. The request type validates itself with a custom `IsValid()` method instead of FluentValidation.
- There is intentionally no service/repository layer. Endpoints query `OedDbContext` / `AuthzDbContext` directly with `.AsNoTracking()`.
- `Infrastructure/Authz` defines the authorization policies (`AtLeastReadRole`, `RequireAdminRole`).
- `Infrastructure/Auditing` wraps requests and writes audit records to Azure Table Storage (or ILogger in Development).

### Frontend

- `oed-admin.client` is a React 19 SPA using React Router and TanStack Query.
- All data calls should go through `src/utils/msalUtils.ts#fetchWithMsal`, which acquires a bearer token before fetch.
- Query factories live under `src/queries/`.
- Role-gated routes are managed in the React app (`App.tsx`).
- UI components are from `@digdir/designsystemet-react`, and user-facing text is Norwegian.

### Data and integrations

- The backend connects to existing PostgreSQL databases owned by other services (`oed`, `oedauthz`) rather than managing its own schema.
- There are no EF Core migrations in this repo; schema changes belong in the owning service repository.
- Existing typed HTTP clients for Altinn/OED should be used instead of creating ad hoc `HttpClient` instances.
- `InstanceToDbDataMigration` is a background service fed by a channel; it is not active unless the corresponding service is registered.

## Key conventions

- New endpoints do nothing until they are registered in `oed-admin.Server/Features/Endpoints.cs`.
- Use the existing feature-group structure and authorization policy on the route instead of creating a separate auth mechanism.
- Prefer a thin DTO over returning database entities directly. `PoorMansMapper` copies only name-matching properties by reflection.
- Be careful not to expose personal data through DTOs; use a deliberately restricted response model.
- For POST search endpoints and any endpoint that returns estate-related data, preserve audit-log coverage by ensuring the middleware can identify affected estate IDs.
- Do not add generic service/repository abstractions just because a feature grows; this codebase uses direct EF access in the endpoint.
- Use `.AsNoTracking()` for read-only queries.
- Reject invalid input with `TypedResults.BadRequest()` inside the request model's `IsValid()` check, not with model-binding validation or FluentValidation.
- The app is intentionally read-mostly and role-gated; most routes are admin-only.
- When working in the client, avoid bare `fetch` calls and prefer the MSAL wrapper.
- User-facing strings and UI labels should be in Norwegian unless a specific exception is required.
- `dotnet build` does not validate the frontend; use `npm run build` before trusting client-side TypeScript issues.

## Deployment and project tooling

- CI/CD is defined under `.github/workflows/` and is driven by the repo's GitHub Actions.
- The repository includes a `.claude/` folder with project-specific tooling for endpoint scaffolding and local setup; prefer the repo's existing patterns over inventing new ones.
- Renovate is configured for dependency updates in the shared Altinn config.
