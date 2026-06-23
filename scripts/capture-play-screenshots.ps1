# Capture Play Store screenshots via adb (USB phone or BlueStacks — no Android Studio).
# Prerequisite: Android Platform-Tools only — https://developer.android.com/tools/releases/platform-tools
# Usage:
#   cd ui
#   .\scripts\capture-play-screenshots.ps1

$ErrorActionPreference = "Stop"
$Package = "com.hussnainahmadsahi.wedeen"
$OutDir = Join-Path (Split-Path $PSScriptRoot -Parent) "play-store-screenshots"

function Test-AdbDevice {
    $devices = adb devices 2>&1 | Select-String "device$"
    if (-not $devices) {
        Write-Host "No device found. Connect phone (USB debugging) or start BlueStacks with adb." -ForegroundColor Red
        exit 1
    }
}

function Grant-AppPermissions {
    Write-Host "Granting location + notification permissions (skips system popup)..." -ForegroundColor Cyan
    adb shell pm grant $Package android.permission.ACCESS_FINE_LOCATION 2>$null
    adb shell pm grant $Package android.permission.ACCESS_COARSE_LOCATION 2>$null
    adb shell pm grant $Package android.permission.POST_NOTIFICATIONS 2>$null
}

function Capture-Screen([string]$name) {
    $path = Join-Path $OutDir $name
    cmd /c "adb exec-out screencap -p > `"$path`""
    $item = Get-Item $path
    Write-Host "Saved $($item.Name) ($([math]::Round($item.Length / 1KB)) KB)" -ForegroundColor Green
}

Test-AdbDevice
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Grant-AppPermissions

Write-Host ""
Write-Host "Output folder: $OutDir" -ForegroundColor Yellow
Write-Host "Open WeDeen on the device. Navigate to a screen, then press ENTER to capture." -ForegroundColor Yellow
Write-Host "When done, run: .\scripts\resize-play-screenshots.ps1" -ForegroundColor Yellow
Write-Host "Type q + ENTER to quit." -ForegroundColor Yellow
Write-Host ""

$index = 1
while ($true) {
    $label = Read-Host "Screen label (e.g. home, timings) or q to quit"
    if ($label -eq "q") { break }
    if ([string]::IsNullOrWhiteSpace($label)) { $label = "screen" }
    $safe = ($label -replace '[^\w\-]', '-').ToLower()
    $file = "{0:D2}-{1}.png" -f $index, $safe
    Capture-Screen $file
    $index++
}

Write-Host "Done. Upload PNGs from:" -ForegroundColor Cyan
Write-Host $OutDir
