package main

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/getlantern/systray"
	"github.com/venum-i/celeste/config"
	"github.com/venum-i/celeste/logger"
	"github.com/venum-i/celeste/syncer"
)

func main() {
	logger.Info("Starting Celeste, version: %s", config.Version)
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
	systray.SetTitle("Celeste")
	systray.SetTooltip("Celeste — I V E N U M I")

	mSync := systray.AddMenuItem("Sincronizar agora", "Força um ciclo")
	mPause := systray.AddMenuItem("Pausar", "Pausa sincronização automática")
	mQuit := systray.AddMenuItem("Sair", "Encerra a Celeste")

	go func() {
		for {
			select {
			case <-mSync.ClickedCh:
				logger.Info("Sincronização manual solicitada")
				syncer.TriggerNow()
			case <-mPause.ClickedCh:
				p := syncer.IsPaused()
				syncer.SetPaused(!p)
				if syncer.IsPaused() {
					mPause.SetTitle("Retomar")
					logger.Info("Sincronização pausada")
				} else {
					mPause.SetTitle("Pausar")
					logger.Info("Sincronização retomada")
					syncer.TriggerNow()
				}
			case <-mQuit.ClickedCh:
				logger.Info("Encerrando Celeste")
				systray.Quit()
				os.Exit(0)
			}
		}
	}()
}

func onExit() {}
