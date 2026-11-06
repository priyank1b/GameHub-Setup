Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path (Get-Location) "assets\icon.png"
$src = [System.Drawing.Image]::FromFile($srcPath)

$sizes = @(
    @{ Width = 300; Height = 300; Name = "store-logo-300x300.png" },
    @{ Width = 150; Height = 150; Name = "store-logo-150x150.png" },
    @{ Width = 71;  Height = 71;  Name = "store-logo-71x71.png" }
)

foreach ($item in $sizes) {
    $dest = New-Object System.Drawing.Bitmap($item.Width, $item.Height)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $item.Width, $item.Height)
    $outPath = Join-Path (Get-Location) ("assets\" + $item.Name)
    $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dest.Dispose()
    Write-Host "Created: $outPath"
}

$src.Dispose()
Write-Host "All store display images created successfully."
