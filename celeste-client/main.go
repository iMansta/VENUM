package main

import (
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/getlantern/systray"
	"github.com/venum-i/celeste/config"
	"github.com/venum-i/celeste/logger"
	"github.com/venum-i/celeste/syncer"
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
	mLogs := systray.AddMenuItem("Abrir pasta de logs", "Abre os logs locais da Anaconda")
	systray.AddSeparator()
	mSync := systray.AddMenuItem("Sincronizar agora", "Força um ciclo")
	mPause := systray.AddMenuItem("Pausar", "Pausa sincronização automática")
	mStatus := systray.AddMenuItem("Status: Ativo", "Estado da sincronização")
	mStatus.Disable()
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Sair", "Encerra a Anaconda")

	go func() {
		for {
			select {
			case <-mPanel.ClickedCh:
				openURL(config.APIBase + "/admin")
			case <-mLogs.ClickedCh:
				openFolder(filepath.Join(os.Getenv("LOCALAPPDATA"), "VENUM-Anaconda", "logs"))
			case <-mSync.ClickedCh:
				logger.Info("Sincronização manual solicitada")
				syncer.TriggerNow()
			case <-mPause.ClickedCh:
				p := syncer.IsPaused()
				syncer.SetPaused(!p)
				if syncer.IsPaused() {
					mPause.SetTitle("Retomar")
					mStatus.SetTitle("Status: Pausado")
					logger.Info("Sincronização pausada")
				} else {
					mPause.SetTitle("Pausar")
					mStatus.SetTitle("Status: Ativo")
					logger.Info("Sincronização retomada")
					syncer.TriggerNow()
				}
			case <-mQuit.ClickedCh:
				logger.Info("Encerrando Anaconda")
				systray.Quit()
				os.Exit(0)
			}
		}
	}()
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

func openURL(url string) {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	if err := cmd.Start(); err != nil {
		logger.Warn("Não foi possível abrir painel no navegador: %v", err)
	}
}

func openFolder(path string) {
	if path == "" {
		return
	}
	cmd := exec.Command("explorer.exe", path)
	if err := cmd.Start(); err != nil {
		logger.Warn("Não foi possível abrir pasta de logs: %v", err)
	}
}
