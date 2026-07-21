package appui

import (
	"os"

	"github.com/getlantern/systray"
	"github.com/venum-i/anaconda/config"
	"github.com/venum-i/anaconda/logger"
	"github.com/venum-i/anaconda/syncer"
)

// WireCommonTray conecta os itens de menu compartilhados entre Anaconda e Anaconda Admin.
func WireCommonTray(
	mHub *systray.MenuItem,
	mLogs *systray.MenuItem,
	mLogsTail *systray.MenuItem,
	mSync *systray.MenuItem,
	mPause *systray.MenuItem,
	mStatus *systray.MenuItem,
	mQuit *systray.MenuItem,
	hubPath string,
	onQuit func(),
) {
	if hubPath == "" {
		hubPath = config.APIBase + "/guild"
	}

	go func() {
		for {
			select {
			case <-mHub.ClickedCh:
				OpenURL(hubPath)
			case <-mLogs.ClickedCh:
				OpenLogFile()
			case <-mLogsTail.ClickedCh:
				OpenLogTailWindow()
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
				if onQuit != nil {
					onQuit()
				}
				logger.Info("Encerrando aplicação")
				systray.Quit()
				os.Exit(0)
			}
		}
	}()
}
