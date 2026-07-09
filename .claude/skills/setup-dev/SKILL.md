---
name: setup-dev
description: Set up or repair a local development environment for oed-admin — dev certificates, the two PostgreSQL databases, user secrets, and client environment variables.
disable-model-invocation: true
---

# Local development setup for oed-admin

Run the prerequisite check first. It reports what is missing without changing anything:

```powershell
pwsh -File .claude/skills/setup-dev/scripts/check-prereqs.ps1
```

Work through whatever it flags, then re-run it. Details for each item below.

## Toolchain

.NET 10 SDK (CI pins `10.0.102`) and Node with npm. The client's dependencies are not installed by
`dotnet build`:

```powershell
cd oed-admin.client; npm ci; cd ..
```

## HTTPS dev certificate

`vite.config.ts` reads a PEM keypair at `$env:APPDATA/ASP.NET/https/oed-admin.client.{pem,key}` and
**throws on startup if it cannot create them**. It shells out to `dotnet dev-certs` itself, but that
fails silently if the root certificate is not trusted. Do it once, explicitly:

```powershell
dotnet dev-certs https --trust
```

## Databases

Two PostgreSQL databases on `localhost:5432`, per `appsettings.Development.json`: `oed` and
`oedauthz`, both reachable as user `oedpguser` / password `secret`.

**These schemas are owned by other services.** This repo has no EF Core migrations and must never gain
one. Get a schema by pointing at a running instance of the owning service's database, or by restoring
a dump from a colleague — not by generating one here.

## Secrets

`appsettings.Development.json` ships placeholders (`<secret>`, `<env>`). Real values go in user
secrets, never in the file. The project's `UserSecretsId` is already set in the csproj.

```powershell
cd oed-admin.Server
dotnet user-secrets set "MaskinportenSettings:ClientId" "<client-id>"
dotnet user-secrets set "MaskinportenSettings:Environment" "test"
dotnet user-secrets set "MaskinportenSettings:EncodedJwk" "<jwk>"
cd ..
```

Without valid Maskinporten settings the app still starts, but every outbound Altinn call fails —
`AddAltinnClients` reads the section eagerly and throws if it is absent entirely.

To skip Maskinporten locally, point `AltinnSettings:PlatformUrl` at `http://localhost:...`. That
switches `IAltinnClient` to `LocalTestTokenHandler` (see
`Infrastructure/Altinn/ServiceCollectionExtensions.cs`), which needs Altinn's local test stack running.

## Client environment variables

Vite needs these at dev/build time; CI supplies them at `dotnet publish`.

- `VITE_CLIENT_ID` — the Entra ID app registration id. MSAL cannot initialise without it, so the SPA
  renders a blank page and the console shows an MSAL config error.
- `VITE_ENVIRONMENT` — label shown in the header (e.g. `local`).

Put them in `oed-admin.client/.env.local` (gitignored):

```
VITE_CLIENT_ID=d96b3149-9c75-4bab-9826-ec5148d983af
VITE_ENVIRONMENT=local
```

That client id is the one in `appsettings.Development.json`. You need an Entra role assignment of
`Admin` or `Read` on that app registration, or the SPA authenticates and then tells you
"Du har ikke tilgang til denne applikasjonen."

## Running

```powershell
dotnet run --project oed-admin.Server
```

Backend on `https://localhost:7156`; SpaProxy launches Vite on `https://localhost:60475` and proxies
`^/api` back. Open the Vite URL. API reference is at `/scalar`.
