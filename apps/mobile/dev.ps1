# iF Fleet — Mobile Dev Launcher
# Run this instead of `npx expo start --clear` when on a new network.
# It auto-detects your current LAN IP, writes it to .env, then starts Metro.
#
# Usage:  .\dev.ps1          (auto-detect Wi-Fi IP)
#         .\dev.ps1 --no-clear   (skip Metro cache clear)

param([switch]$NoClear)

# ── 1. Find the active LAN IP ──────────────────────────────────────────────
$ip = (
  Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.PrefixOrigin -eq 'Dhcp' -and
    $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|Docker|VPN'
  } |
  Sort-Object InterfaceMetric |
  Select-Object -First 1
).IPAddress

if (-not $ip) {
  Write-Host "ERROR: Could not detect a LAN IP. Are you connected to Wi-Fi?" -ForegroundColor Red
  exit 1
}

Write-Host "Detected LAN IP: $ip" -ForegroundColor Cyan

# ── 2. Update REACT_NATIVE_PACKAGER_HOSTNAME in .env ──────────────────────
$envFile = Join-Path $PSScriptRoot ".env"
$content  = Get-Content $envFile -Raw

# Replace existing value or append
if ($content -match 'REACT_NATIVE_PACKAGER_HOSTNAME=') {
  $content = $content -replace 'REACT_NATIVE_PACKAGER_HOSTNAME=.*', "REACT_NATIVE_PACKAGER_HOSTNAME=$ip"
} else {
  $content += "`nREACT_NATIVE_PACKAGER_HOSTNAME=$ip"
}

Set-Content $envFile $content -NoNewline
Write-Host ".env updated: REACT_NATIVE_PACKAGER_HOSTNAME=$ip" -ForegroundColor Green

# ── 3. Start Metro ─────────────────────────────────────────────────────────
# EXPO_NO_DOCTOR=1 — skips the Expo CLI version-check network call that throws
# "Body is unusable: Body has already been read" on Node 18+ when the Expo API
# endpoint returns a non-JSON response (firewall / offline / Expo server issue).
# This is purely a startup health-check; skipping it has no effect on bundling.
Write-Host "Starting Expo Metro..." -ForegroundColor Cyan
$env:EXPO_NO_DOCTOR = "1"
if ($NoClear) {
  npx expo start
} else {
  npx expo start --clear
}
