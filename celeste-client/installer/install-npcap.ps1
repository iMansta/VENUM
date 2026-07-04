$ErrorActionPreference = "Stop"

try {
  $dll = Join-Path $env:SystemRoot "System32\Npcap\wpcap.dll"
  if (Test-Path $dll) {
    exit 0
  }

  $tmpInstaller = Join-Path $env:TEMP "npcap-setup.exe"
  Invoke-WebRequest -Uri "https://npcap.com/dist/npcap-1.80.exe" -OutFile $tmpInstaller -UseBasicParsing
  Start-Process -FilePath $tmpInstaller -ArgumentList "/S" -Wait
} catch {
  # Não bloqueia instalação da Anaconda se Npcap falhar.
}

exit 0

