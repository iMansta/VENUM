package main

import (
	"context"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/getlantern/systray"
	"github.com/venum-i/anaconda/adminui"
	"github.com/venum-i/anaconda/api"
	"github.com/venum-i/anaconda/collector"
	"github.com/venum-i/anaconda/config"
	"github.com/venum-i/anaconda/logger"
)

func main() {
	logger.Info("Starting Anaconda Admin, version: %s", config.Version)
	logger.Info("Ferramenta administrativa da guilda I V E N U M I")

	stop := make(chan struct{})
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		close(stop)
		systray.Quit()
	}()

	systray.Run(onReady(stop), onExit)
}

func onReady(stop <-chan struct{}) func() {
	return func() {
		if icon := loadTrayIcon(); len(icon) > 0 {
			systray.SetIcon(icon)
		}
		systray.SetTitle("Anaconda Admin")
		systray.SetTooltip("Anaconda Admin — métricas da guilda")

		client := api.New()
		clientID := collector.EnsureAdminClientID()
		pairingToken := collector.LoadPairingToken()

		mPanel := systray.AddMenuItem("Abrir painel de envio", "Formulário local para métricas da guilda")
		mHub := systray.AddMenuItem("Abrir painel VENUM", "Abre o painel web da guilda")
		mToken := systray.AddMenuItem("Token salvo: "+maskToken(pairingToken), "Token de pareamento atual")
		mToken.Disable()
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Sair", "Encerra a Anaconda Admin")

		ui := adminui.New(client, clientID, pairingToken)

		go func() {
			for {
				select {
				case <-stop:
					return
				case <-mPanel.ClickedCh:
					openMetricsPanel(ui, clientID, pairingToken)
				case <-mHub.ClickedCh:
					openURL(config.APIBase + "/admin")
				case <-mQuit.ClickedCh:
					logger.Info("Encerrando Anaconda Admin")
					systray.Quit()
					os.Exit(0)
				}
			}
		}()
	}
}

func onExit() {}

func openMetricsPanel(ui *adminui.Server, clientID, pairingToken string) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	url, err := ui.Start(ctx)
	if err != nil {
		logger.Warn("Não foi possível abrir painel local: %v", err)
		return
	}
	logger.Info("Painel admin local em %s (cliente %s, token %s)", url, clientID, maskToken(pairingToken))
	openURL(url)

	// Mantém o servidor ativo por alguns minutos para permitir envio.
	time.AfterFunc(8*time.Minute, cancel)
}

func maskToken(token string) string {
	if token == "" {
		return "não configurado"
	}
	if len(token) <= 4 {
		return token
	}
	return "****" + token[len(token)-4:]
}

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
		logger.Warn("Não foi possível abrir URL: %v", err)
	}
}
