Add-Type -AssemblyName System.Drawing

$src = "C:\Users\priyank\.gemini\antigravity-ide\brain\f929c408-0688-41de-bcb5-15445e3eefe1\new_launcher_icon_1790921269929.jpg"
$destPng = Join-Path (Get-Location) "assets\icon.png"
$destIco = Join-Path (Get-Location) "assets\icon.ico"

$bmp = [System.Drawing.Bitmap]::FromFile($src)
$bmp.Save($destPng, [System.Drawing.Imaging.ImageFormat]::Png)

# Generate multi-size icon for Windows
$iconBmp = New-Object System.Drawing.Bitmap($bmp, 256, 256)
$hIcon = $iconBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream($destIco, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()

# Generate tray icon (32x32)
$trayBmp = New-Object System.Drawing.Bitmap($bmp, 32, 32)
$trayPng = Join-Path (Get-Location) "assets\tray-icon.png"
$trayBmp.Save($trayPng, [System.Drawing.Imaging.ImageFormat]::Png)

$iconBmp.Dispose()
$trayBmp.Dispose()
$bmp.Dispose()

Write-Host "OmniPlay icon assets generated successfully."
