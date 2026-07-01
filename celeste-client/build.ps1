# Build celeste.exe — requer Go 1.22+
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$ldflags = @(
  "-s", "-w",
  "-X", "github.com/venum-i/celeste/config.APIBase=https://venum-eight.vercel.app",
  "-X", "github.com/venum-i/celeste/config.AgentToken=venum_celeste_bmdvk_7Xk9mP2wQ5nR8tY4vL6jH1sF3dA0cE",
  "-X", "github.com/venum-i/celeste/config.Version=1.0.0"
) -join " "

Write-Host "[celeste] go mod tidy..."
go mod tidy

Write-Host "[celeste] building celeste.exe..."
go build -ldflags $ldflags -o celeste.exe .

if (-not (Test-Path "celeste.exe")) {
  Write-Error "Build falhou"
}

Write-Host "[celeste] OK: $Root\celeste.exe"
