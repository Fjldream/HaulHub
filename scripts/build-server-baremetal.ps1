param(
  [int]$HttpPort = 8088,
  [string]$ApiBaseUrl = "/api",
  [string]$MobileAppBasePath = "/app/",
  [string]$PathPrefix = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$releaseRoot = Join-Path $root "release"
$releaseDir = Join-Path $releaseRoot "haulhub-server"
$archive = Join-Path $releaseRoot "haulhub-server.zip"

Set-Location $root

$normalizedPrefix = $PathPrefix.Trim()
$normalizedPrefix = $normalizedPrefix.Trim("/")
$basePath = if ($normalizedPrefix) { "/$normalizedPrefix" } else { "" }

if ($basePath) {
  if (-not $PSBoundParameters.ContainsKey("ApiBaseUrl")) {
    $ApiBaseUrl = "$basePath/api"
  }
  if (-not $PSBoundParameters.ContainsKey("MobileAppBasePath")) {
    $MobileAppBasePath = "$basePath/app/"
  }
}

if (-not $MobileAppBasePath.StartsWith("/")) {
  $MobileAppBasePath = "/$MobileAppBasePath"
}
if (-not $MobileAppBasePath.EndsWith("/")) {
  $MobileAppBasePath = "$MobileAppBasePath/"
}

Remove-Item -Recurse -Force $releaseDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $releaseDir | Out-Null

$env:NEXT_PUBLIC_API_BASE_URL = $ApiBaseUrl
$env:NEXT_PUBLIC_BASE_PATH = $basePath
$env:NEXT_PUBLIC_AMAP_JS_KEY = if ($env:NEXT_PUBLIC_AMAP_JS_KEY) { $env:NEXT_PUBLIC_AMAP_JS_KEY } else { "" }
$env:NEXT_PUBLIC_AMAP_SECURITY_JS_CODE = if ($env:NEXT_PUBLIC_AMAP_SECURITY_JS_CODE) { $env:NEXT_PUBLIC_AMAP_SECURITY_JS_CODE } else { "" }
$env:VITE_API_BASE_URL = $ApiBaseUrl
$env:VITE_H5_BASE = $MobileAppBasePath
npm --workspace apps/api run db:generate
npm --workspace apps/admin-web run build
npm --workspace apps/driver-uni run build:h5

Copy-Item package.json, package-lock.json -Destination $releaseDir
Copy-Item -Recurse apps/api (Join-Path $releaseDir "apps/api")
$adminWorkspaceDir = Join-Path $releaseDir "apps/admin-web"
New-Item -ItemType Directory -Force $adminWorkspaceDir | Out-Null
Copy-Item apps/admin-web/package.json (Join-Path $adminWorkspaceDir "package.json")
Copy-Item -Recurse packages (Join-Path $releaseDir "packages")

$adminDir = Join-Path $releaseDir "admin-web"
New-Item -ItemType Directory -Force $adminDir | Out-Null
Copy-Item -Recurse apps/admin-web/.next/standalone/apps/admin-web/* $adminDir
Copy-Item -Recurse apps/admin-web/.next/static (Join-Path $adminDir ".next/static")
if (Test-Path apps/admin-web/public) {
  Copy-Item -Recurse apps/admin-web/public (Join-Path $adminDir "public")
}
Copy-Item -Recurse apps/admin-web/.next/standalone/node_modules (Join-Path $releaseDir "node_modules")

$mobileRelativePath = $MobileAppBasePath.Trim("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
$driverH5Dir = Join-Path (Join-Path $releaseDir "web-root") $mobileRelativePath
New-Item -ItemType Directory -Force $driverH5Dir | Out-Null
Copy-Item -Recurse apps/driver-uni/dist/build/h5/* $driverH5Dir

New-Item -ItemType Directory -Force (Join-Path $releaseDir "deploy/systemd") | Out-Null
Copy-Item deploy/systemd/*.service (Join-Path $releaseDir "deploy/systemd")
Copy-Item deploy/ecosystem.config.cjs (Join-Path $releaseDir "ecosystem.config.cjs")

$nginx = Get-Content deploy/nginx.baremetal.conf -Raw
$nginx = $nginx.Replace('${HTTP_PORT}', [string]$HttpPort)
$nginx = $nginx.Replace('${API_LOCATION}', "$ApiBaseUrl/")
$nginx = $nginx.Replace('${FILES_LOCATION}', "$(if ($basePath) { "$basePath/files/" } else { "/files/" })")
$nginx = $nginx.Replace('${APP_EXACT_LOCATION}', $MobileAppBasePath.TrimEnd("/"))
$nginx = $nginx.Replace('${APP_LOCATION}', $MobileAppBasePath)
$nginx = $nginx.Replace('${ADMIN_EXACT_LOCATION}', $(if ($basePath) { $basePath } else { "/__haulhub_admin_exact_disabled" }))
$nginx = $nginx.Replace('${ADMIN_LOCATION}', $(if ($basePath) { "$basePath/" } else { "/" }))
Set-Content -Path (Join-Path $releaseDir "deploy/nginx.conf") -Value $nginx -Encoding UTF8

@"
NODE_ENV=production
PORT=4000
DATABASE_URL=file:/opt/haulhub/data/haulhub.db
UPLOAD_DIR=/opt/haulhub/data/uploads
NEXT_PUBLIC_API_BASE_URL=$ApiBaseUrl
NEXT_INTERNAL_API_BASE_URL=http://127.0.0.1:4000
NEXT_PUBLIC_BASE_PATH=$basePath
VITE_API_BASE_URL=$ApiBaseUrl
VITE_H5_BASE=$MobileAppBasePath
AMAP_WEB_SERVICE_KEY=
NEXT_PUBLIC_AMAP_JS_KEY=
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=
"@ | ForEach-Object {
  [System.IO.File]::WriteAllText(
    (Join-Path $releaseDir ".env.example"),
    $_,
    [System.Text.UTF8Encoding]::new($false)
  )
}

Copy-Item scripts/install-baremetal.sh (Join-Path $releaseDir "install.sh")
Copy-Item scripts/patch-baremetal.sh (Join-Path $releaseDir "patch.sh")

Remove-Item -Force $archive -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $releaseDir "*") -DestinationPath $archive

Write-Host ""
Write-Host "Bare-metal server package created: $archive"
Write-Host "Nginx public port: $HttpPort"
Write-Host "Admin Web: $(if ($basePath) { "$basePath/" } else { "/" })"
Write-Host "API: $ApiBaseUrl"
Write-Host "Mobile Web App: $MobileAppBasePath"
