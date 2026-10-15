# scripts/package-and-sign.ps1
# Automates building, signing, and bundling a trusted client distribution package

$ErrorActionPreference = "Stop"

$workspaceRoot = Resolve-Path "$PSScriptRoot\.."
$desktopDir = Join-Path $workspaceRoot "apps\desktop"
$distDir = Join-Path $desktopDir "release-dist"
$clientPackageDir = Join-Path $distDir "Bakery-Store-Client-Package"

Write-Host "=== 1. Building Desktop App and NSIS Installer ===" -ForegroundColor Cyan
Set-Location $workspaceRoot
node scripts/switch-better-sqlite3.cjs electron
Write-Host "Stopping any running instances of Bakery Store..." -ForegroundColor Yellow
Stop-Process -Name "Bakery Store" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Set-Location $desktopDir
pnpm run dist

Write-Host "`n=== 2. Creating / Retrieving Authenticode Code Signing Certificate ===" -ForegroundColor Cyan
$certSubject = "CN=Mezaan Sweets & Bakers"
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -eq $certSubject } | Select-Object -First 1

if (-not $cert) {
    Write-Host "Creating new Code Signing certificate for '$certSubject'..." -ForegroundColor Yellow
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $certSubject `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -KeyUsage DigitalSignature `
        -FriendlyName "Mezaan Sweets & Bakers POS Certificate" `
        -NotAfter (Get-Date).AddYears(10)
}

Write-Host "Using Certificate Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green

# Prepare Client Package Folder
if (Test-Path $clientPackageDir) {
    Remove-Item $clientPackageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $clientPackageDir -Force | Out-Null

# Export Public Certificate (.cer)
$cerPath = Join-Path $clientPackageDir "Bakery-Store-Security-Certificate.cer"
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null
Write-Host "Exported public certificate to: $cerPath"

Write-Host "`n=== 3. Digitally Signing Installers ===" -ForegroundColor Cyan
$installerPath = Join-Path $distDir "Bakery Store Setup 0.1.0.exe"
$portablePath = Join-Path $distDir "Bakery Store 0.1.0.exe"

if (Test-Path $installerPath) {
    Write-Host "Signing Installer: $installerPath"
    Set-AuthenticodeSignature -FilePath $installerPath -Certificate $cert -HashAlgorithm SHA256 | Out-Null
}

if (Test-Path $portablePath) {
    Write-Host "Signing Portable Executable: $portablePath"
    Set-AuthenticodeSignature -FilePath $portablePath -Certificate $cert -HashAlgorithm SHA256 | Out-Null
}

# Copy signed binaries to Client Package Folder
Copy-Item $installerPath -Destination (Join-Path $clientPackageDir "Bakery Store Setup 0.1.0.exe") -Force
if (Test-Path $portablePath) {
    Copy-Item $portablePath -Destination (Join-Path $clientPackageDir "Bakery Store 0.1.0.exe") -Force
}

Write-Host "`n=== 4. Creating 1-Click Trusted Installation Script ===" -ForegroundColor Cyan
$installBatContent = @'
@echo off
setlocal
cd /d "%~dp0"

echo ==========================================================
echo   Mezaan Sweets & Bakers - Trusted Client Setup
echo ==========================================================
echo.
echo Installing security certificate to eliminate SmartScreen warnings...

:: Add certificate to CurrentUser Root & TrustedPublisher stores (No admin prompt required)
certutil -user -addstore -f "Root" "Bakery-Store-Security-Certificate.cer" >nul 2>&1
certutil -user -addstore -f "TrustedPublisher" "Bakery-Store-Security-Certificate.cer" >nul 2>&1

:: Also attempt machine-wide if running as admin
certutil -addstore -f "Root" "Bakery-Store-Security-Certificate.cer" >nul 2>&1
certutil -addstore -f "TrustedPublisher" "Bakery-Store-Security-Certificate.cer" >nul 2>&1

echo Removing web download mark (Zone.Identifier)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Filter '*.exe' | Unblock-File"

echo Launching Bakery Store Setup...
start "" "%~dp0Bakery Store Setup 0.1.0.exe"
exit
'@

$installBatPath = Join-Path $clientPackageDir "1-Click-Install.bat"
[System.IO.File]::WriteAllText($installBatPath, $installBatContent, [System.Text.Encoding]::ASCII)

$readmeContent = @'
# Mezaan Sweets & Bakers — Client Installation Instructions

## How to Install:
1. Extract all files from this zip folder.
2. Double-click "1-Click-Install.bat".
3. The installer will open and install directly without any "Windows protected your PC" or "Run anyway" warnings.

## Portable Version:
If you prefer not to install and run directly:
- Simply run "Bakery Store 0.1.0.exe".
'@

$readmePath = Join-Path $clientPackageDir "INSTRUCTIONS.txt"
[System.IO.File]::WriteAllText($readmePath, $readmeContent, [System.Text.Encoding]::UTF8)

Write-Host "`n=== 5. Creating Final Client Zip Archive ===" -ForegroundColor Cyan
Start-Sleep -Seconds 2
$clientZipPath = Join-Path $distDir "Bakery-Store-Client-Package.zip"
if (Test-Path $clientZipPath) {
    Remove-Item $clientZipPath -Force
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($clientPackageDir, $clientZipPath)

Write-Host "`n=== 6. Creating Dedicated Update Package ===" -ForegroundColor Cyan
$updatePackageDir = Join-Path $distDir "Bakery-Store-Update-Package"
if (Test-Path $updatePackageDir) {
    Remove-Item $updatePackageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $updatePackageDir -Force | Out-Null

# Copy signed binaries and certificate to Update Package
Copy-Item $cerPath -Destination (Join-Path $updatePackageDir "Bakery-Store-Security-Certificate.cer") -Force
Copy-Item $installerPath -Destination (Join-Path $updatePackageDir "Bakery Store Setup 0.1.0.exe") -Force
if (Test-Path $portablePath) {
    Copy-Item $portablePath -Destination (Join-Path $updatePackageDir "Bakery Store 0.1.0.exe") -Force
}

$updateBatContent = @'
@echo off
setlocal
cd /d "%~dp0"

echo ==========================================================
echo   Mezaan Sweets & Bakers - Application Update
echo ==========================================================
echo.
echo 1. Stopping any currently running Bakery Store instances...
taskkill /F /IM "Bakery Store.exe" >nul 2>&1
timeout /t 1 /nobreak >nul

echo 2. Updating security certificate...
certutil -user -addstore -f "Root" "Bakery-Store-Security-Certificate.cer" >nul 2>&1
certutil -user -addstore -f "TrustedPublisher" "Bakery-Store-Security-Certificate.cer" >nul 2>&1

echo 3. Unblocking update package files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Filter '*.exe' | Unblock-File"

echo 4. Applying update...
echo (Your SQLite database, sales records, products, and configurations are safely preserved!)
start "" "%~dp0Bakery Store Setup 0.1.0.exe"
exit
'@

$updateBatPath = Join-Path $updatePackageDir "1-Click-Update.bat"
[System.IO.File]::WriteAllText($updateBatPath, $updateBatContent, [System.Text.Encoding]::ASCII)

$updateReadmeContent = @'
# Mezaan Sweets & Bakers — Software Update Instructions

## How to Update:
1. Extract all files from this zip folder.
2. Double-click "1-Click-Update.bat".
3. The installer will automatically update your Bakery Store to the latest version.
4. All existing sales data, stock ledgers, staff accounts, and configurations remain 100% safe and intact.

## Portable Users:
If you are running the portable version instead of an installation:
- Simply close the old app and run the new "Bakery Store 0.1.0.exe".
'@

$updateReadmePath = Join-Path $updatePackageDir "UPDATE-INSTRUCTIONS.txt"
[System.IO.File]::WriteAllText($updateReadmePath, $updateReadmeContent, [System.Text.Encoding]::UTF8)

$updateZipPath = Join-Path $distDir "Bakery-Store-Update-Package.zip"
if (Test-Path $updateZipPath) {
    Remove-Item $updateZipPath -Force
}
Start-Sleep -Seconds 1
[System.IO.Compression.ZipFile]::CreateFromDirectory($updatePackageDir, $updateZipPath)

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host " SUCCESS! Packages are ready to distribute:" -ForegroundColor Green
Write-Host " [1] Client Package (New Install) : $clientZipPath" -ForegroundColor Yellow
Write-Host " [2] Update Package (Existing POS): $updateZipPath" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green

