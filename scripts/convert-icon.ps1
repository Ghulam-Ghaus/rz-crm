Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\ASD\.gemini\antigravity-ide\brain\46f8ae21-7f37-432c-86a4-2e7354d47d49\mezaan_app_icon_1788880413164.jpg"
$rootDir = "d:\PL\bakery-app"

$src = [System.Drawing.Image]::FromFile($srcPath)

# 1. Save full-res 512x512 and 256x256 PNGs
function Save-ResizedPng($image, $width, $height, $targetPath) {
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($image, 0, 0, $width, $height)
    $bmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$desktopBuildDir = Join-Path $rootDir "apps\desktop\build"
$rendererPublicDir = Join-Path $rootDir "apps\renderer\public"
$desktopDistRenderer = Join-Path $rootDir "apps\desktop\dist\renderer"

New-Item -ItemType Directory -Force -Path $desktopBuildDir | Out-Null
New-Item -ItemType Directory -Force -Path $rendererPublicDir | Out-Null
if (Test-Path $desktopDistRenderer) {
    New-Item -ItemType Directory -Force -Path $desktopDistRenderer | Out-Null
}

$iconPngPath = Join-Path $desktopBuildDir "icon.png"
Save-ResizedPng $src 256 256 $iconPngPath
Save-ResizedPng $src 256 256 (Join-Path $rendererPublicDir "icon.png")
Save-ResizedPng $src 512 512 (Join-Path $rendererPublicDir "mezaan-logo.png")

if (Test-Path $desktopDistRenderer) {
    Copy-Item $iconPngPath (Join-Path $desktopDistRenderer "icon.png") -Force
    Copy-Item (Join-Path $rendererPublicDir "mezaan-logo.png") (Join-Path $desktopDistRenderer "mezaan-logo.png") -Force
}

# 2. Build standard Windows 256x256 PNG-compressed ICO file
$pngBytes = [System.IO.File]::ReadAllBytes($iconPngPath)

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms

# ICONDIR header (6 bytes)
$bw.Write([UInt16]0) # Reserved
$bw.Write([UInt16]1) # Type: 1 = ICO
$bw.Write([UInt16]1) # Count: 1 image

# ICONDIRENTRY (16 bytes)
$bw.Write([Byte]0) # Width: 256 (0 represents 256)
$bw.Write([Byte]0) # Height: 256 (0 represents 256)
$bw.Write([Byte]0) # ColorCount: 0
$bw.Write([Byte]0) # Reserved
$bw.Write([UInt16]1) # Color planes: 1
$bw.Write([UInt16]32) # Bits per pixel: 32
$bw.Write([UInt32]$pngBytes.Length) # Image size in bytes
$bw.Write([UInt32]22) # Offset from start of file (6 + 16 = 22)

# Write raw PNG bytes
$bw.Write($pngBytes)
$bw.Flush()

$icoBytes = $ms.ToArray()
$bw.Close()
$ms.Close()

$iconIcoPath = Join-Path $desktopBuildDir "icon.ico"
[System.IO.File]::WriteAllBytes($iconIcoPath, $icoBytes)
[System.IO.File]::WriteAllBytes((Join-Path $rendererPublicDir "favicon.ico"), $icoBytes)

if (Test-Path $desktopDistRenderer) {
    [System.IO.File]::WriteAllBytes((Join-Path $desktopDistRenderer "favicon.ico"), $icoBytes)
}

$src.Dispose()
Write-Host "Successfully generated all icons and assets!"
