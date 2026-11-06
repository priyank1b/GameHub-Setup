Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\priyank\.gemini\antigravity-ide\brain\f929c408-0688-41de-bcb5-15445e3eefe1\super_hero_art_1790924457599.jpg"
$outPath = Join-Path (Get-Location) "assets\store-super-hero-1920x1080.png"

$src = [System.Drawing.Image]::FromFile($srcPath)
$dest = New-Object System.Drawing.Bitmap(1920, 1080)
$g = [System.Drawing.Graphics]::FromImage($dest)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, 0, 0, 1920, 1080)

$dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$dest.Dispose()
$src.Dispose()

Write-Host "Super hero banner saved successfully to $outPath"
