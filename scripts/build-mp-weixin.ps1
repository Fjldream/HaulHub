param(
  [string]$ApiBaseUrl = "https://your-domain.com/api"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:VITE_API_BASE_URL = $ApiBaseUrl
npm --workspace apps/driver-uni run build:mp-weixin

Write-Host ""
Write-Host "微信小程序构建完成：apps/driver-uni/dist/build/mp-weixin"
Write-Host "请用微信开发者工具打开该目录并上传。"
