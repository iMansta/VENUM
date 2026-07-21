package appui

import (
	"os/exec"

	"github.com/venum-i/anaconda/logger"
)

// OpenURL abre uma URL no navegador padrão do Windows.
func OpenURL(url string) {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	if err := cmd.Start(); err != nil {
		logger.Warn("Não foi possível abrir URL: %v", err)
	}
}
