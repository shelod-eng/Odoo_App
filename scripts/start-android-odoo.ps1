$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:EXPO_PUBLIC_ODOO_URL) {
  $env:EXPO_PUBLIC_ODOO_URL = "http://mmatli.ddns.net:1616"
}
if (-not $env:EXPO_PUBLIC_ODOO_DB) {
  $env:EXPO_PUBLIC_ODOO_DB = "full_test"
}
if (-not $env:EXPO_PUBLIC_ODOO_SITE_MODEL) {
  $env:EXPO_PUBLIC_ODOO_SITE_MODEL = "travel.site"
}
if (-not $env:EXPO_PUBLIC_ODOO_PROXY_URL) {
  $env:EXPO_PUBLIC_ODOO_PROXY_URL = "http://10.0.2.2:17777"
}
if (-not $env:ODOO_URL) {
  $env:ODOO_URL = $env:EXPO_PUBLIC_ODOO_URL
}

$proxy = Get-NetTCPConnection -LocalPort 17777 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proxy) {
  Start-Process -FilePath "node" -ArgumentList "dev-odoo-proxy.js" -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

$health = Invoke-RestMethod -Uri "http://127.0.0.1:17777/health" -TimeoutSec 5
Write-Host "Odoo proxy ready: http://127.0.0.1:17777 -> $($health.odooUrl)" -ForegroundColor Green
Write-Host "Expo Android will use proxy: $env:EXPO_PUBLIC_ODOO_PROXY_URL" -ForegroundColor Green

npx expo start --android --clear
