package appui

import (
	"github.com/getlantern/systray"
	"github.com/venum-i/anaconda/api"
	"github.com/venum-i/anaconda/collector"
	"github.com/venum-i/anaconda/logger"
)

// WirePairingMenu adiciona fluxo de pareamento de conta VENUM na bandeja.
func WirePairingMenu(mPair *systray.MenuItem, client *api.Client) {
	go func() {
		for range mPair.ClickedCh {
			handlePairing(client)
		}
	}()
}

func handlePairing(client *api.Client) {
	current := ""
	if link := collector.LoadProfileLink(); link != nil {
		current = link.Username
	}

	token := PromptMemberPairingToken(current)
	if token == "" {
		return
	}

	clientID := collector.EnsureClientID()
	result, err := client.RedeemPairingToken(clientID, token)
	if err != nil {
		logger.Error("Pareamento falhou: %v", err)
		return
	}

	if err := collector.SaveProfileLink(collector.ProfileLink{
		ProfileID: result.ProfileID,
		Username:  result.Username,
	}); err != nil {
		logger.Error("Não foi possível salvar vínculo local: %v", err)
		return
	}

	logger.Info("Conta VENUM vinculada: %s (profile_id=%s)", result.Username, result.ProfileID)
	logger.Info("Progresso de missões individuais será atribuído a este perfil.")
}
