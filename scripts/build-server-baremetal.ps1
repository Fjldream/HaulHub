param(
  [int]$HttpPort = 8088,
  [string]$ApiBaseUrl = "/api"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $root "release"
$releaseDir = Join-Path $releaseRoot "haulhub-server"
$archive = Join-Path $releaseRoot "haulhub-server.zip"

Set-Location $root

Remove-Item -Recurse -Force $releaseDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $releaseDir | Out-Null

$env:NEXT_PUBLIC_API_BASE_URL = $ApiBaseUrl
npm --workspace apps/api run db:generate
npm --workspace apps/admin-web run build

Copy-Item package.json, package-lock.json -Destination $releaseDir
Copy-Item -Recurse apps/api (Join-Path $releaseDir "apps/api")
Copy-Item -Recurse packages (Join-Path $releaseDir "packages")

$adminDir = Join-Path $releaseDir "admin-web"
New-Item -ItemType Directory -Force $adminDir | Out-Null
Copy-Item -Recurse apps/admin-web/.next/standalone/apps/admin-web/* $adminDir
Copy-Item -Recurse apps/admin-web/.next/static (Join-Path $adminDir ".next/static")
if (Test-Path apps/admin-web/public) {
  Copy-Item -Recurse apps/admin-web/public (Join-Path $adminDir "public")
}
Copy-Item -Recurse apps/admin-web/.next/standalone/node_modules (Join-Path $releaseDir "node_modules")

New-Item -ItemType Directory -Force (Join-Path $releaseDir "deploy/systemd") | Out-Null
Copy-Item deploy/systemd/*.service (Join-Path $releaseDir "deploy/systemd")

$nginx = Get-Content deploy/nginx.baremetal.conf -Raw
$nginx = $nginx.Replace('${HTTP_PORT}', [string]$HttpPort)
Set-Content -Path (Join-Path $releaseDir "deploy/nginx.conf") -Value $nginx -Encoding UTF8

@"
NODE_ENV=production
PORT=4000
DATABASE_URL=file:/opt/haulhub/data/haulhub.db
UPLOAD_DIR=/opt/haulhub/data/uploads
NEXT_PUBLIC_API_BASE_URL=$ApiBaseUrl
"@ | Set-Content -Path (Join-Path $releaseDir ".env.example") -Encoding UTF8

Copy-Item scripts/install-baremetal.sh (Join-Path $releaseDir "install.sh")

Remove-Item -Force $archive -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $releaseDir "*") -DestinationPath $archive

Write-Host ""
Write-Host "Bare-metal server package created: $archive"
Write-Host "Nginx public port: $HttpPort"
