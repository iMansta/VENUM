package syncer

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/venum-i/anaconda/api"
	"github.com/venum-i/anaconda/collector"
	"github.com/venum-i/anaconda/config"
	"github.com/venum-i/anaconda/logger"
)

func flushPendingGuildBank(client *api.Client) int {
	batches, err := collector.DrainGuildBankQueue(20)
	if err != nil || len(batches) == 0 {
		return 0
	}

	sent := 0
	for _, raw := range batches {
		var payload api.GuildBankPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			logger.Warn("Fila banco guilda: entrada inválida ignorada")
			sent++
			continue
		}
		resp, err := client.SubmitGuildBankBalance(payload)
		if err != nil {
			logger.Warn("Fila banco guilda: reenvio interrompido (%v)", err)
			break
		}
		sent++
		logGuildBankResult(resp, payload.SilverBalance, true)
	}

	if sent > 0 {
		if err := collector.CommitGuildBankQueue(sent); err != nil {
			logger.Warn("Fila banco guilda: falha ao limpar entradas enviadas: %v", err)
		}
	}
	return sent
}

func submitGuildBankReadings(
	client *api.Client,
	readings []collector.GuildBankReading,
	clientID, profileID, username string,
) {
	for _, reading := range readings {
		submitGuildBankReading(client, reading, clientID, profileID, username)
	}
}

func submitGuildBankReading(
	client *api.Client,
	reading collector.GuildBankReading,
	clientID, profileID, username string,
) {
	if reading.SilverBalance <= 0 {
		return
	}

	payload := api.GuildBankPayload{
		ClientID:            clientID,
		SilverBalance:       reading.SilverBalance,
		ProfileID:           strings.TrimSpace(profileID),
		DedupeWindowSeconds: 60,
		Meta: map[string]any{
			"source":     "photon_sniff",
			"version":    config.Version,
			"eventCode":  reading.EventCode,
			"confidence": reading.Confidence,
			"sniffSource": reading.Source,
		},
	}
	if username != "" {
		payload.Meta["username"] = username
	}
	if profileID != "" {
		payload.Meta["profileId"] = profileID
	}
	if reading.GuildID != "" {
		payload.GuildID = reading.GuildID
		payload.Meta["guildId"] = reading.GuildID
	}
	if reading.RawHint != nil {
		payload.Meta["rawHint"] = reading.RawHint
	}
	if !reading.ObservedAt.IsZero() {
		payload.Meta["observedAt"] = reading.ObservedAt.UTC().Format("2006-01-02T15:04:05Z07:00")
	}

	resp, err := client.SubmitGuildBankBalance(payload)
	if err != nil {
		if enqueueErr := collector.EnqueueGuildBank(payload); enqueueErr != nil {
			logger.Warn("Banco guilda: %v (fila offline indisponível: %v)", err, enqueueErr)
		} else {
			pending := collector.PendingGuildBankCount()
			logger.Warn("Banco guilda: %v — salvo na fila offline (%d pendente(s))", err, pending)
		}
		return
	}

	logGuildBankResult(resp, reading.SilverBalance, false)
}

func submitGuildBankChannelEvent(client *api.Client, ev collector.GuildBankEvent) {
	clientID := collector.EnsureClientID()
	profileLink := collector.LoadProfileLink()

	username := collector.ResolveAlbionName()
	profileID := ""
	if profileLink != nil {
		profileID = profileLink.ProfileID
		if username == "" {
			username = profileLink.Username
		}
	}

	payload := api.GuildBankPayload{
		ClientID:            clientID,
		SilverBalance:       ev.SilverBalance,
		ProfileID:           strings.TrimSpace(profileID),
		DedupeWindowSeconds: 60,
		Meta: map[string]any{
			"source":     "photon_sniff",
			"version":    config.Version,
			"eventCode":  ev.EventCode,
			"observedAt": time.Now().UTC().Format(time.RFC3339),
		},
	}
	if username != "" {
		payload.Meta["username"] = username
	}
	if profileID != "" {
		payload.Meta["profileId"] = profileID
	}
	if ev.GuildID != "" {
		payload.GuildID = ev.GuildID
		payload.Meta["guildId"] = ev.GuildID
	}

	resp, err := client.SubmitGuildBankBalance(payload)
	if err != nil {
		if enqueueErr := collector.EnqueueGuildBank(payload); enqueueErr != nil {
			logger.Warn("[Syncer] Falha ao enviar saldo do banco: %v (fila offline indisponível)", err)
		} else {
			logger.Warn("[Syncer] Falha ao enviar saldo do banco: %v — salvo na fila offline", err)
		}
		return
	}

	logGuildBankResult(resp, ev.SilverBalance, false)
}

func runGuildBankListener(client *api.Client, stop <-chan struct{}) {
	for {
		select {
		case <-stop:
			return
		case ev := <-collector.GuildBankChannel:
			logger.Info("[Network] Banco da guilda detectado: %d prata(s)", ev.SilverBalance)
			go submitGuildBankChannelEvent(client, ev)
		}
	}
}

func logGuildBankResult(resp *api.GuildBankResponse, balance int64, fromQueue bool) {
	if resp == nil {
		return
	}
	prefix := "Banco guilda"
	if fromQueue {
		prefix = "Fila banco guilda"
	}
	if resp.Inserted {
		logger.Info("%s: saldo %d registrado (historyId=%s)", prefix, balance, resp.HistoryID)
		return
	}
	if strings.TrimSpace(resp.SkippedReason) != "" {
		logger.Info("%s: saldo %d ignorado (%s)", prefix, balance, resp.SkippedReason)
		return
	}
	logger.Info("%s: saldo %d processado (sem insert)", prefix, balance)
}
