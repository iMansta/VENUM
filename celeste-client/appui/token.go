package appui

import (
	"os/exec"
	"regexp"
	"strings"

	"github.com/venum-i/anaconda/logger"
)

var tokenRx = regexp.MustCompile(`^[A-Z0-9]{6,12}$`)

// NormalizePairingToken valida e normaliza o código gerado no painel web.
func NormalizePairingToken(raw string) string {
	token := strings.ToUpper(strings.TrimSpace(raw))
	token = strings.ReplaceAll(token, " ", "")
	token = strings.ReplaceAll(token, "-", "")
	if !tokenRx.MatchString(token) {
		return ""
	}
	return token
}

// ReadTokenFromClipboard lê a área de transferência do Windows e extrai um token válido.
func ReadTokenFromClipboard() string {
	cmd := exec.Command("powershell.exe", "-NoProfile", "-Command", "(Get-Clipboard -Raw).ToString()")
	out, err := cmd.Output()
	if err != nil {
		logger.Warn("Não foi possível ler a área de transferência: %v", err)
		return ""
	}
	return NormalizePairingToken(string(out))
}

// PromptMemberPairingToken abre diálogo para vincular conta de membro.
func PromptMemberPairingToken(current string) string {
	return promptPairingToken(current,
		"Cole o token gerado no painel VENUM (Missões > Vincular Anaconda). Válido por 15 minutos.",
		"Anaconda — Vincular conta VENUM",
	)
}

// PromptPairingToken abre diálogo para token admin (métricas da guilda).
func PromptPairingToken(current string) string {
	return promptPairingToken(current,
		"Cole o token gerado no painel VENUM (Admin > Anaconda). Válido por 15 minutos.",
		"Anaconda Admin — Token de pareamento",
	)
}

func promptPairingToken(current, body, title string) string {
	escaped := strings.ReplaceAll(current, "'", "''")
	escapedBody := strings.ReplaceAll(body, "'", "''")
	escapedTitle := strings.ReplaceAll(title, "'", "''")
	script := `
Add-Type -AssemblyName Microsoft.VisualBasic
$current = '` + escaped + `'
$result = [Microsoft.VisualBasic.Interaction]::InputBox(
  '` + escapedBody + `',
  '` + escapedTitle + `',
  $current
)
if ($null -eq $result) { '' } else { $result }
`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-Command", script)
	out, err := cmd.Output()
	if err != nil {
		logger.Warn("Não foi possível abrir diálogo de token: %v", err)
		return ""
	}
	return NormalizePairingToken(string(out))
}
