package syncer

import (
	"encoding/json"
	"strings"
	"sync/atomic"

	"github.com/venum-i/anaconda/api"
	"github.com/venum-i/anaconda/collector"
	"github.com/venum-i/anaconda/logger"
)

var identityWarned atomic.Bool

func flushPendingTelemetry(client *api.Client) int {
	batches, err := collector.DrainTelemetryQueue(20)
	if err != nil || len(batches) == 0 {
		return 0
	}

	sent := 0
	for _, raw := range batches {
		var payload api.TelemetryPayload
		if err := json.Unmarshal(raw, &payload); err != nil {
			logger.Warn("Fila offline: lote inválido ignorado")
			sent++
			continue
		}
		resp, err := client.SendTelemetry(payload)
		if err != nil {
			logger.Warn("Fila offline: reenvio interrompido (%v)", err)
			break
		}
		logTelemetryWarnings(resp)
		sent++
		if resp != nil && resp.Inserted > 0 {
			logger.Info("Fila offline: %d observação(ões) reenviada(s)", resp.Inserted)
		}
	}

	if sent > 0 {
		if err := collector.CommitTelemetryQueue(sent); err != nil {
			logger.Warn("Fila offline: falha ao limpar entradas enviadas: %v", err)
		}
	}
	return sent
}

func sendTelemetry(client *api.Client, payload api.TelemetryPayload) {
	resp, err := client.SendTelemetry(payload)
	if err != nil {
		if enqueueErr := collector.EnqueueTelemetry(payload); enqueueErr != nil {
			logger.Warn("Telemetria: %v (fila offline indisponível: %v)", err, enqueueErr)
		} else {
			pending := collector.PendingTelemetryCount()
			logger.Warn("Telemetria: %v — salvo na fila offline (%d lote(s) pendente(s))", err, pending)
		}
		return
	}

	if resp != nil && resp.Inserted > 0 {
		logger.Info("%d observações locais enviadas", resp.Inserted)
	}
	logTelemetryWarnings(resp)
}

func logTelemetryWarnings(resp *api.TelemetryResponse) {
	if resp == nil || len(resp.Warnings) == 0 {
		return
	}
	for _, w := range resp.Warnings {
		if strings.TrimSpace(w.Message) == "" {
			continue
		}
		logger.Warn("Hub [%s]: %s", w.Code, w.Message)
	}
}

func warnIdentityIssues(albionName, hostUser string, profileLinked bool) {
	if profileLinked || albionName != "" {
		return
	}
	if !identityWarned.CompareAndSwap(false, true) {
		return
	}
	logger.Warn("IDENTIDADE: personagem Albion não detectado — progresso de missões NÃO será atribuído.")
	logger.Warn("Vincule sua conta: menu da bandeja > Vincular conta VENUM (token no painel Missões).")
	logger.Warn("Alternativa: defina ANACONDA_ALBION_NAME ou jogue alguns segundos para detectar via log/Photon.")
	if hostUser != "" {
		logger.Warn("O hub NÃO usa o usuário Windows (%s) como identidade de jogador.", hostUser)
	}
}

func stampObservationIdentity(obs []api.Observation, username, profileID string) {
	username = strings.TrimSpace(username)
	profileID = strings.TrimSpace(profileID)
	if username == "" && profileID == "" {
		return
	}
	for i := range obs {
		if obs[i].Payload == nil {
			obs[i].Payload = map[string]any{}
		}
		if username != "" {
			if v, ok := obs[i].Payload["username"]; !ok || strings.TrimSpace(toStr(v)) == "" {
				obs[i].Payload["username"] = username
			}
		}
		if profileID != "" {
			obs[i].Payload["profile_id"] = profileID
		}
	}
}
