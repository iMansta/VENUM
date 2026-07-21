package main

import (
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/getlantern/systray"
	"github.com/venum-i/anaconda/api"
	"github.com/venum-i/anaconda/appui"
	"github.com/venum-i/anaconda/config"
	"github.com/venum-i/anaconda/logger"
	"github.com/venum-i/anaconda/syncer"
)

func main() {
	logger.Info("Starting Anaconda, version: %s", config.Version)
	logger.Info("This is a third-party tool for guild I V E N U M I — not affiliated with Sandbox Interactive")
	logger.Info("Watching Albion — use the tray icon to pause, sync or quit")

	stop := make(chan struct{})
	go syncer.RunLoop(stop)

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		close(stop)
		systray.Quit()
	}()

	systray.Run(onReady, onExit)
	close(stop)
}

func onReady() {
	if icon := loadTrayIcon(); len(icon) > 0 {
		systray.SetIcon(icon)
	}
	systray.SetTitle("Anaconda")
	systray.SetTooltip("Anaconda — I V E N U M I (rodando em segundo plano)")

	mPanel := systray.AddMenuItem("Abrir Painel VENUM", "Abre o painel web da guilda")
	mPair := systray.AddMenuItem("Vincular conta VENUM", "Cola token gerado no painel Missões")
	mLogs := systray.AddMenuItem("Abrir arquivo de log", "Abre anaconda.log no Bloco de Notas (Ctrl+F para buscar)")
	mLogsTail := systray.AddMenuItem("Ver log ao vivo (PowerShell)", "Tail do log em tempo real")
	systray.AddSeparator()
	mSync := systray.AddMenuItem("Sincronizar agora", "Força um ciclo")
	mPause := systray.AddMenuItem("Pausar", "Pausa sincronização automática")
	mStatus := systray.AddMenuItem("Status: Ativo", "Estado da sincronização")
	mStatus.Disable()
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Sair", "Encerra a Anaconda")

	hubClient := api.New()
	appui.WirePairingMenu(mPair, hubClient)
	appui.WireCommonTray(mPanel, mLogs, mLogsTail, mSync, mPause, mStatus, mQuit, config.APIBase+"/guild", nil)
}

func onExit() {}

func loadTrayIcon() []byte {
	exe, err := os.Executable()
	if err != nil {
		return nil
	}
	baseDir := filepath.Dir(exe)
	candidates := []string{
		filepath.Join(baseDir, "anaconda-icon.ico"),
		filepath.Join(baseDir, "anaconda-icon.png"),
	}
	for _, path := range candidates {
		b, err := os.ReadFile(path)
		if err == nil && len(b) > 0 {
			return b
		}
	}
	return nil
}
