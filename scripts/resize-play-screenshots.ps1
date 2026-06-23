# Resize raw adb/phone screenshots to 1080x2340 for Google Play (portrait phone).
# Usage:
#   cd ui
#   .\scripts\resize-play-screenshots.ps1
# Optional: .\scripts\resize-play-screenshots.ps1 -Source "C:\path\to\pngs"

param(
    [string]$Source = "",
    [int]$Width = 1080,
    [int]$Height = 2340
)

$ErrorActionPreference = "Stop"
$UiRoot = Split-Path $PSScriptRoot -Parent
if ([string]::IsNullOrWhiteSpace($Source)) {
    $Source = Join-Path $UiRoot "play-store-screenshots"
}
$Dest = Join-Path $Source "1080x2340"

if (-not (Test-Path $Source)) {
    Write-Host "Source folder not found: $Source" -ForegroundColor Red
    Write-Host "Run capture-play-screenshots.ps1 first, or pass -Source." -ForegroundColor Yellow
    exit 1
}

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$files = Get-ChildItem -Path $Source -Filter "*.png" -File | Where-Object { $_.DirectoryName -ne $Dest }
if (-not $files.Count) {
    Write-Host "No PNG files in $Source" -ForegroundColor Red
    exit 1
}

foreach ($file in $files) {
    $srcBmp = [System.Drawing.Bitmap]::FromFile($file.FullName)
    try {
        $destBmp = New-Object System.Drawing.Bitmap $Width, $Height
        $g = [System.Drawing.Graphics]::FromImage($destBmp)
        try {
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $g.Clear([System.Drawing.Color]::FromArgb(246, 241, 231))

            $srcRatio = $srcBmp.Width / $srcBmp.Height
            $destRatio = $Width / $destBmp.Height

            if ($srcRatio -gt $destRatio) {
                $newHeight = $Height
                $newWidth = [int]($Height * $srcRatio)
            } else {
                $newWidth = $Width
                $newHeight = [int]($Width / $srcRatio)
            }

            $x = [int](($Width - $newWidth) / 2)
            $y = [int](($Height - $newHeight) / 2)
            $g.DrawImage($srcBmp, $x, $y, $newWidth, $newHeight)
        } finally {
            $g.Dispose()
        }

        $outPath = Join-Path $Dest $file.Name
        $destBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $destBmp.Dispose()
        Write-Host "OK $($file.Name) -> 1080x2340" -ForegroundColor Green
    } finally {
        $srcBmp.Dispose()
    }
}

Write-Host ""
Write-Host "Upload PNGs from:" -ForegroundColor Cyan
Write-Host $Dest
