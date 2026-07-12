# Build anaconda.exe — requer Go 1.22+
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$goCandidates = @(
  "${env:ProgramFiles}\Go\bin\go.exe",
  "C:\Go\bin\go.exe"
)

$goCmd = $goCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $goCmd) {
  $cmd = Get-Command go.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) {
    $goCmd = $cmd.Source
  }
}

if (-not $goCmd) {
  Write-Error ("Go não encontrado. Caminhos testados: " + ($goCandidates -join ", "))
}

$ldflags = @(
  "-s", "-w",
  "-H=windowsgui",
  "-X", "github.com/venum-i/anaconda/config.APIBase=https://venum-eight.vercel.app",
  "-X", "github.com/venum-i/anaconda/config.AgentToken=venum_celeste_bmdvk_7Xk9mP2wQ5nR8tY4vL6jH1sF3dA0cE",
  "-X", "github.com/venum-i/anaconda/config.Version=1.2.0"
) -join " "

Write-Host "[anaconda] go mod tidy..."
& $goCmd mod tidy

Write-Host "[anaconda] building anaconda.exe..."
& $goCmd build -ldflags $ldflags -o anaconda.exe .

if (-not (Test-Path "anaconda.exe")) {
  Write-Error "Build falhou"
}

Write-Host "[anaconda] building anaconda-admin.exe..."
& $goCmd build -ldflags $ldflags -o anaconda-admin.exe ./cmd/anaconda-admin

if (-not (Test-Path "anaconda-admin.exe")) {
  Write-Error "Build admin falhou"
}

Write-Host "[anaconda] OK: $Root\anaconda.exe"
Write-Host "[anaconda] OK: $Root\anaconda-admin.exe"
