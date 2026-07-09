#!/usr/bin/env pwsh
# Read-only prerequisite check for local oed-admin development. Changes nothing.
# Usage: pwsh -File .claude/skills/setup-dev/scripts/check-prereqs.ps1

$ErrorActionPreference = 'Continue'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')
$problems = @()

function Report($ok, $label, $detail, $fix) {
    if ($ok) {
        Write-Host "  OK    $label" -ForegroundColor Green
        if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray }
    } else {
        Write-Host "  MISS  $label" -ForegroundColor Yellow
        if ($detail) { Write-Host "        $detail" -ForegroundColor DarkGray }
        $script:problems += "$label -> $fix"
    }
}

Write-Host "`noed-admin local setup check`n" -ForegroundColor Cyan
Write-Host "Toolchain" -ForegroundColor Cyan

$dotnet = (Get-Command dotnet -ErrorAction SilentlyContinue)
$dotnetVer = if ($dotnet) { (& dotnet --version 2>$null) } else { $null }
Report ($dotnetVer -like '10.*') '.NET 10 SDK' "found: $dotnetVer" 'install .NET 10 SDK (CI pins 10.0.102)'

$node = (Get-Command node -ErrorAction SilentlyContinue)
$nodeVer = if ($node) { (& node --version 2>$null) } else { $null }
Report ([bool]$node) 'Node.js' "found: $nodeVer" 'install Node.js LTS'

$modules = Join-Path $repoRoot 'oed-admin.client\node_modules'
Report (Test-Path $modules) 'client dependencies' $modules 'cd oed-admin.client; npm ci'

Write-Host "`nHTTPS dev certificate" -ForegroundColor Cyan

$certBase = if ($env:APPDATA) { Join-Path $env:APPDATA 'ASP.NET\https' } else { Join-Path $HOME '.aspnet/https' }
$pem = Join-Path $certBase 'oed-admin.client.pem'
$key = Join-Path $certBase 'oed-admin.client.key'
Report ((Test-Path $pem) -and (Test-Path $key)) 'vite PEM keypair' $certBase 'dotnet dev-certs https --trust  (vite regenerates the PEM on next start)'

if ($dotnet) {
    & dotnet dev-certs https --check --quiet 2>$null | Out-Null
    Report ($LASTEXITCODE -eq 0) 'dev-certs trusted' '' 'dotnet dev-certs https --trust'
}

Write-Host "`nDatabases (localhost:5432)" -ForegroundColor Cyan

foreach ($db in @('oed', 'oedauthz')) {
    $ok = $false
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $ok = $c.ConnectAsync('localhost', 5432).Wait(1500)
        $c.Close()
    } catch { $ok = $false }
    Report $ok "postgres reachable (for '$db')" 'tcp localhost:5432' 'start PostgreSQL; restore the schema from the owning service (never add an EF migration here)'
    break  # one TCP probe covers both databases
}

Write-Host "`nSecrets" -ForegroundColor Cyan

$secrets = if ($dotnet) { (& dotnet user-secrets list --project (Join-Path $repoRoot 'oed-admin.Server') 2>$null) } else { $null }
$hasJwk = $secrets -match 'MaskinportenSettings:EncodedJwk'
Report ([bool]$hasJwk) 'Maskinporten user secrets' '' 'dotnet user-secrets set "MaskinportenSettings:EncodedJwk" "<jwk>"  (see SKILL.md)'

Write-Host "`nClient environment" -ForegroundColor Cyan

$envLocal = Join-Path $repoRoot 'oed-admin.client\.env.local'
$hasClientId = (Test-Path $envLocal) -and ((Get-Content $envLocal -Raw) -match 'VITE_CLIENT_ID\s*=\s*\S')
Report $hasClientId 'VITE_CLIENT_ID' $envLocal 'create oed-admin.client/.env.local with VITE_CLIENT_ID and VITE_ENVIRONMENT'

Write-Host ""
if ($problems.Count -eq 0) {
    Write-Host "All checks passed. Run: dotnet run --project oed-admin.Server" -ForegroundColor Green
    exit 0
}
Write-Host "$($problems.Count) item(s) need attention:" -ForegroundColor Yellow
$problems | ForEach-Object { Write-Host "  - $_" }
exit 1
