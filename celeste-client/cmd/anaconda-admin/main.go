package main

import (
	"context"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/getlantern/systray"
	"github.com/venum-i/anaconda/adminui"
	"github.com/venum-i/anaconda/api"
	"github.com/venum-i/anaconda/appui"
	"github.com/venum-i/anaconda/collector"
	"github.com/venum-i/anaconda/config"
	"github.com/venum-i/anaconda/logger"
	"github.com/venum-i/anaconda/syncer"
)

func main() {
	logger.Info("Starting Anaconda Admin, version: %s", config.Version)
	logger.Info("Anaconda Admin — sincronização completa + métricas da guilda I V E N U M I")

	stop := make(chan struct{})
	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()

	go syncer.RunLoop(stop)

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		close(stop)
		appCancel()
		systray.Quit()
	}()

	systray.Run(onReady(appCtx, appCancel, stop), onExit)
	close(stop)
}

func onReady(appCtx context.Context, appCancel context.CancelFunc, stop <-chan struct{}) func() {
	return func() {
		if icon := loadTrayIcon(); len(icon) > 0 {
			systray.SetIcon(icon)
		}
		systray.SetTitle("Anaconda Admin")
		systray.SetTooltip("Anaconda Admin — sync + métricas da guilda")

		client := api.New()
		clientID := collector.EnsureAdminClientID()
		pairingToken := collector.LoadPairingToken()
		ui := adminui.New(client, clientID, pairingToken)

		if url, err := ui.Start(appCtx); err != nil {
			logger.Warn("Painel admin local indisponível na inicialização: %v", err)
			logger.Info("Use o menu 'Colar token' ou 'Digitar token' na bandeja e depois 'Enviar métricas da guilda'")
		} else {
			logger.Info("Painel admin local em %s (cliente %s, token %s)", url, clientID, maskToken(pairingToken))
		}

		mMetrics := systray.AddMenuItem("Enviar métricas da guilda", "Abre o formulário local de prata/temporada")
		mPasteToken := systray.AddMenuItem("Colar token (área de transferência)", "Cole o token copiado do painel VENUM")
		mTypeToken := systray.AddMenuItem("Digitar token...", "Abre caixa para inserir o token manualmente")
		mHub := systray.AddMenuItem("Abrir painel VENUM", "Abre o painel web da guilda")
		mLogs := systray.AddMenuItem("Abrir arquivo de log", "Abre anaconda.log no Bloco de Notas")
		mLogsTail := systray.AddMenuItem("Ver log ao vivo (PowerShell)", "Tail do log em tempo real")
		systray.AddSeparator()
		mSync := systray.AddMenuItem("Sincronizar agora", "Força um ciclo")
		mPause := systray.AddMenuItem("Pausar", "Pausa sincronização automática")
		mStatus := systray.AddMenuItem("Status: Ativo", "Estado da sincronização")
		mStatus.Disable()
		mToken := systray.AddMenuItem("Token: "+maskToken(pairingToken), "Token de pareamento atual")
		mToken.Disable()
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Sair", "Encerra a Anaconda Admin")

		saveToken := func(token string) {
			if token == "" {
				logger.Warn("Token inválido. Copie o código de 8 caracteres do painel VENUM (Admin > Anaconda).")
				return
			}
			if err := collector.SavePairingToken(token); err != nil {
				logger.Warn("Não foi possível salvar token: %v", err)
				return
			}
			ui.SetToken(token)
			mToken.SetTitle("Token: " + maskToken(token))
			logger.Info("Token de pareamento salvo: %s", maskToken(token))
		}

		go func() {
			for {
				select {
				case <-stop:
					return
				case <-mMetrics.ClickedCh:
					url, err := ui.EnsureRunning(appCtx)
					if err != nil {
						logger.Error("Painel local indisponível: %v", err)
						logger.Info("Configure o token pelo menu da bandeja e tente novamente")
						continue
					}
					appui.OpenURL(url)
				case <-mPasteToken.ClickedCh:
					saveToken(appui.ReadTokenFromClipboard())
				case <-mTypeToken.ClickedCh:
					saveToken(appui.PromptPairingToken(ui.Token()))
				}
			}
		}()

		appui.WireCommonTray(mHub, mLogs, mLogsTail, mSync, mPause, mStatus, mQuit, config.APIBase+"/admin", appCancel)
	}
}

func onExit() {}

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
