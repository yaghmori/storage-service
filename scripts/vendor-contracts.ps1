# Copy sibling messaging-contracts into ./vendor for Docker builds
$ErrorActionPreference = "Stop"
$src = Join-Path $PSScriptRoot "..\..\messaging-contracts"
if (-not (Test-Path $src)) {
  Write-Error "messaging-contracts not found at $src"
}
$dst = Join-Path $PSScriptRoot "..\vendor\messaging-contracts"
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Copy-Item -Recurse $src $dst
Write-Host "Vendored $src -> $dst"
