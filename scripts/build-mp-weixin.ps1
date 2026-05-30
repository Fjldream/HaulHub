param(
  [string]$ApiBaseUrl = "https://your-domain.com/api"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:VITE_API_BASE_URL = $ApiBaseUrl
npm --workspace apps/driver-uni run build:mp-weixin

Write-Host ""
Write-Host "WeChat Mini Program build completed: apps/driver-uni/dist/build/mp-weixin"
Write-Host "Open that directory in WeChat Developer Tools and upload it."
