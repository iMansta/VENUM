package appui

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/venum-i/anaconda/logger"
)

func ensureLogFile() string {
	logPath := logger.FilePath()
	if logPath == "" {
		return ""
	}
	_ = os.MkdirAll(filepath.Dir(logPath), 0o755)
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		f, createErr := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY, 0o644)
		if createErr == nil {
			_ = f.Close()
		}
	}
	return logPath
}

// OpenLogFile abre o arquivo de log no Bloco de Notas (melhor para Ctrl+F no debug de rede).
func OpenLogFile() {
	logPath := ensureLogFile()
	if logPath == "" {
		return
	}
	logger.Info("Abrindo arquivo de log: %s", logPath)
	cmd := exec.Command("notepad.exe", logPath)
	_ = cmd.Start()
}

// OpenLogTailWindow abre PowerShell com tail do log (opcional; requer ExecutionPolicy Bypass).
func OpenLogTailWindow() {
	logPath := ensureLogFile()
	if logPath == "" {
		return
	}

	dir := filepath.Dir(logPath)
	scriptPath := filepath.Join(dir, "tail-anaconda-log.ps1")
	script := fmt.Sprintf(`$ErrorActionPreference = 'Continue'
$p = '%s'
Write-Host 'Anaconda - log ao vivo' -ForegroundColor Cyan
Write-Host $p -ForegroundColor DarkGray
if (-not (Test-Path -LiteralPath $p)) {
  New-Item -ItemType File -Path $p -Force | Out-Null
}
Get-Content -LiteralPath $p -Tail 200 -Wait
`, strings.ReplaceAll(logPath, "'", "''"))

	if err := os.WriteFile(scriptPath, []byte(script), 0o644); err != nil {
		logger.Warn("Falha ao criar script de tail: %v — abrindo Bloco de Notas", err)
		OpenLogFile()
		return
	}

	cmd := exec.Command(
		"powershell.exe",
		"-NoExit",
		"-NoProfile",
		"-ExecutionPolicy", "Bypass",
		"-File", scriptPath,
	)
	cmd.Dir = dir
	if err := cmd.Start(); err != nil {
		logger.Warn("Falha ao abrir tail PowerShell: %v — abrindo Bloco de Notas", err)
		OpenLogFile()
	}
}
