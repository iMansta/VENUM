$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (!(Test-Path ".\anaconda.exe")) {
  Write-Host "[anaconda] anaconda.exe não encontrado, compilando..."
  .\build.ps1
}

$assetsDir = ".\installer\assets"
if (!(Test-Path $assetsDir)) {
  New-Item -ItemType Directory -Path $assetsDir | Out-Null
}

$sourcePng = "..\public\assets\anaconda-icon.png"
if (!(Test-Path $sourcePng)) {
  Write-Error "Ícone base não encontrado em $sourcePng"
}

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($sourcePng)

try {
  $wizard = New-Object System.Drawing.Bitmap 164, 314
  $g1 = [System.Drawing.Graphics]::FromImage($wizard)
  $g1.Clear([System.Drawing.Color]::FromArgb(11, 15, 26))
  $g1.DrawImage($img, 10, 70, 144, 144)
  $g1.Dispose()
  $wizard.Save((Join-Path $assetsDir "wizard.bmp"), [System.Drawing.Imaging.ImageFormat]::Bmp)
  $wizard.Dispose()

  $small = New-Object System.Drawing.Bitmap 55, 55
  $g2 = [System.Drawing.Graphics]::FromImage($small)
  $g2.Clear([System.Drawing.Color]::FromArgb(11, 15, 26))
  $g2.DrawImage($img, 0, 0, 55, 55)
  $g2.Dispose()
  $small.Save((Join-Path $assetsDir "wizard-small.bmp"), [System.Drawing.Imaging.ImageFormat]::Bmp)
  $small.Dispose()

  # Ícone com fundo sólido para não ficar "invisível" no tray do Windows.
  $iconCanvas = New-Object System.Drawing.Bitmap 256, 256
  $g3 = [System.Drawing.Graphics]::FromImage($iconCanvas)
  $g3.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g3.Clear([System.Drawing.Color]::FromArgb(15, 23, 42))
  $g3.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(31, 41, 55))), 6, 6, 244, 244)
  $g3.DrawImage($img, 26, 26, 204, 204)
  $font = New-Object System.Drawing.Font("Segoe UI", 42, [System.Drawing.FontStyle]::Bold)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 204, 21))
  $g3.DrawString("V", $font, $brush, 90, 88)
  $brush.Dispose()
  $font.Dispose()
  $g3.Dispose()

  $iconPngPath = Join-Path $assetsDir "anaconda-icon-256.png"
  $iconCanvas.Save($iconPngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $iconCanvas.Dispose()
  $pngBytes = [System.IO.File]::ReadAllBytes($iconPngPath)
  $icoPath = Join-Path $assetsDir "anaconda.ico"
  $fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
  $bw = New-Object System.IO.BinaryWriter($fs)
  # ICONDIR
  $bw.Write([UInt16]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]1)
  # ICONDIRENTRY
  $bw.Write([byte]0) # 256px (0 = 256)
  $bw.Write([byte]0) # 256px (0 = 256)
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([UInt16]1)   # planes
  $bw.Write([UInt16]32)  # bitcount
  $bw.Write([UInt32]$pngBytes.Length)
  $bw.Write([UInt32]22)  # data offset
  $bw.Write($pngBytes)
  $bw.Flush()
  $bw.Close()
  $fs.Close()
}
finally {
  $img.Dispose()
}

$isccCandidates = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
  "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe"
)

$iscc = $isccCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) {
  $cmd = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    $iscc = $cmd.Source
  }
}

if (-not $iscc) {
  Write-Error ("Inno Setup 6 não encontrado. Caminhos testados: " + ($isccCandidates -join ", "))
}

& $iscc ".\installer\Anaconda.iss"
Write-Host "[anaconda] Instalador gerado em public/downloads/Anaconda-Setup.exe"
