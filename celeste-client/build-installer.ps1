$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (!(Test-Path ".\celeste.exe")) {
  Write-Host "[celeste] celeste.exe não encontrado, compilando..."
  .\build.ps1
}

$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (!(Test-Path $iscc)) {
  Write-Error "Inno Setup 6 não encontrado em: $iscc"
}

& $iscc ".\installer\Celeste.iss"
Write-Host "[celeste] Instalador gerado em public/downloads/Celeste-Setup.exe"
