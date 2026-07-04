package syncer

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/venum-i/celeste/api"
	"github.com/venum-i/celeste/collector"
	"github.com/venum-i/celeste/config"
	"github.com/venum-i/celeste/logger"
)

var (
	running             atomic.Bool
	paused              atomic.Bool
	lastOK              atomic.Int64
	lastPriceSync       atomic.Int64
	lastPveFameSnapshot atomic.Int64
	npcapLogged         atomic.Bool
	thresholdMu         sync.RWMutex
	mobFameThresholds   = []int{10000}
)

func IsPaused() bool { return paused.Load() }
func LastOK() time.Time {
	t := lastOK.Load()
	if t == 0 {
		return time.Time{}
	}
	return time.Unix(t, 0)
}

func SetPaused(v bool) { paused.Store(v) }

func setMobFameThresholds(values []int) {
	unique := map[int]struct{}{}
	for _, v := range values {
		if v > 0 {
			unique[v] = struct{}{}
		}
	}
	if len(unique) == 0 {
		unique[10000] = struct{}{}
	}

	normalized := make([]int, 0, len(unique))
	for v := range unique {
		normalized = append(normalized, v)
	}
	sort.Ints(normalized)

	thresholdMu.Lock()
	mobFameThresholds = normalized
	thresholdMu.Unlock()
}

func getMobFameThresholds() []int {
	thresholdMu.RLock()
	defer thresholdMu.RUnlock()
	out := make([]int, len(mobFameThresholds))
	copy(out, mobFameThresholds)
	return out
}

func RunLoop(stop <-chan struct{}) {
	client := api.New()
	clientID := collector.EnsureClientID()
	watcher := collector.NewWatcher()
	sniffer := collector.NewPassiveSniffer()
	lastGuild := time.Time{}

	logger.Info("Anaconda — guilda %s", config.GuildName)
	logger.Info("Hub: %s", config.APIBase)
	logger.Info("Client ID: %s", clientID)

	if err := client.Ping(); err != nil {
		logger.Error("Falha ao conectar ao hub: %v", err)
		logger.Warn("Verifique internet ou aguarde manutenção do servidor")
	} else {
		logger.Info("Conectado ao hub VENUM")
	}

	runCycle(client, clientID, watcher, sniffer, &lastGuild)

	ticker := time.NewTicker(config.SyncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if !paused.Load() {
				runCycle(client, clientID, watcher, sniffer, &lastGuild)
			}
		}
	}
}

func runCycle(client *api.Client, clientID string, watcher *collector.Watcher, sniffer *collector.PassiveSniffer, lastGuild *time.Time) {
	if !running.CompareAndSwap(false, true) {
		return
	}
	defer running.Store(false)

	if paused.Load() {
		return
	}

	start := time.Now()
	logger.Info("Iniciando ciclo de sincronização")

	if shouldSyncPrices(clientID) {
		if err := syncPrices(client); err != nil {
			logger.Error("Preços: %v", err)
		} else {
			lastPriceSync.Store(time.Now().Unix())
		}
	}

	if time.Since(*lastGuild) >= config.GuildEvery {
		guildSync, err := client.SyncGuild(clientID, os.Getenv("USERNAME"))
		if err != nil {
			logger.Error("Guilda: %v", err)
		} else {
			sourceMissions := guildSync.PlayerPveMissions
			if len(sourceMissions) == 0 {
				sourceMissions = guildSync.ActivePveMissions
			}

			thresholds := make([]int, 0, len(sourceMissions))
			for _, mission := range sourceMissions {
				if mission.MinFameThreshold > 0 {
					thresholds = append(thresholds, mission.MinFameThreshold)
				}
			}
			setMobFameThresholds(thresholds)
			logger.Info("Missões PvE sincronizadas: player=%d, ativas=%d, thresholds=%v",
				len(guildSync.PlayerPveMissions), len(guildSync.ActivePveMissions), getMobFameThresholds())
			logger.Info("Membros da guilda sincronizados")
			*lastGuild = time.Now()
		}
	}

	observations, err := watcher.ReadObservations(100)
	meta := map[string]any{
		"version":     config.Version,
		"hostName":    os.Getenv("COMPUTERNAME"),
		"username":    os.Getenv("USERNAME"),
		"gameLogPath": watcher.Path(),
	}
	if sniffer != nil {
		ready, capErr := sniffer.Status()
		meta["npcap_ready"] = ready
		if capErr != nil {
			meta["npcap_error"] = capErr.Error()
			if npcapLogged.CompareAndSwap(false, true) {
				logger.Warn("Npcap indisponível. Instale pelo assistente da Anaconda para habilitar captura passiva.")
			}
		} else if ready && npcapLogged.CompareAndSwap(false, true) {
			logger.Info("Npcap ativo: captura passiva de rede habilitada")
		}
	}
	if watcher.ShouldWarnPlayerLog() {
		logger.Warn("Anaconda detectou Player.log. Esse arquivo normalmente não contém kills/fama detalhados; a contagem de missões pode não atualizar.")
	}
	if sniffer != nil {
		netObs, netErr := sniffer.CaptureWindow(800*time.Millisecond, 500)
		if netErr != nil {
			logger.Warn("Captura passiva: %v", netErr)
		} else if len(netObs) > 0 {
			observations = append(observations, netObs...)
			derived := derivePassiveGameplayObservations(netObs)
			if len(derived) > 0 {
				observations = append(observations, derived...)
				logger.Info("Captura passiva: %d evento(s) de gameplay inferido(s)", len(derived))
			}
			logger.Info("Captura passiva: %d evento(s) UDP coletado(s)", len(netObs))
		}
	}

	dynamicMobKills := deriveDynamicMobKillsFromFame(observations, getMobFameThresholds())
	if len(dynamicMobKills) > 0 {
		observations = append(observations, dynamicMobKills...)
		logger.Info("PvE dinâmico: %d abate(s) inferido(s) por delta de fama", len(dynamicMobKills))
	}

	meta["mob_fame_thresholds"] = getMobFameThresholds()

	if err != nil {
		if err == collector.ErrGameLogNotFound {
			logger.Warn("Logs Albion: game.log não encontrado. Abra o Albion e jogue alguns segundos para iniciar o log.")
		} else {
			logger.Warn("Logs Albion: %v", err)
		}
		if _, telErr := client.SendTelemetry(api.TelemetryPayload{
			ClientID:     clientID,
			Observations: []api.Observation{},
			Meta:         meta,
		}); telErr != nil {
			logger.Warn("Heartbeat: %v", telErr)
		}
	} else if len(observations) > 0 {
		inserted, telErr := client.SendTelemetry(api.TelemetryPayload{
			ClientID:     clientID,
			Observations: observations,
			Meta:         meta,
		})
		if telErr != nil {
			logger.Warn("Telemetria: %v", telErr)
		} else {
			logger.Info("%d observações locais enviadas", inserted)
		}
	} else {
		logger.Info("Nenhuma observação nova no log do Albion neste ciclo")
		if _, telErr := client.SendTelemetry(api.TelemetryPayload{
			ClientID:     clientID,
			Observations: []api.Observation{},
			Meta:         meta,
		}); telErr != nil {
			logger.Warn("Heartbeat: %v", telErr)
		}
	}

	if err := client.SyncEvents(); err != nil {
		logger.Warn("Eventos: %v", err)
	}

	if err := client.SyncMissions(); err != nil {
		logger.Warn("Missões: %v", err)
	}

	lastOK.Store(time.Now().Unix())
	logger.Info("Ciclo concluído em %.1fs — Watching Albion", time.Since(start).Seconds())
}

func syncPrices(client *api.Client) error {
	catalog, err := client.Catalog()
	if err != nil {
		return err
	}

	itemIDs := catalog.ItemIDs
	locations := catalog.Locations
	batchSize := catalog.BatchSize
	if batchSize <= 0 {
		batchSize = 40
	}
	if len(locations) == 0 {
		locations = []string{"Martlock", "Thetford", "Fort Sterling", "Lymhurst", "Bridgewatch", "Caerleon"}
	}

	locParam := strings.Join(locations, ",")
	total := 0
	httpClient := &http.Client{Timeout: 60 * time.Second}

	for i := 0; i < len(itemIDs); i += batchSize {
		end := i + batchSize
		if end > len(itemIDs) {
			end = len(itemIDs)
		}
		batch := itemIDs[i:end]
		url := fmt.Sprintf("%s/api/v2/stats/prices/%s.json?locations=%s&qualities=1",
			config.AlbionDataBase, strings.Join(batch, ","), locParam)

		res, err := httpClient.Get(url)
		if err != nil {
			logger.Warn("Lote %d: %v", i/batchSize+1, err)
			continue
		}

		var prices []map[string]any
		if err := json.NewDecoder(res.Body).Decode(&prices); err != nil {
			res.Body.Close()
			continue
		}
		res.Body.Close()

		rows := make([]map[string]any, 0, len(prices))
		for _, row := range prices {
			itemID, _ := row["item_id"].(string)
			city, _ := row["city"].(string)
			if itemID == "" || city == "" {
				continue
			}
			rows = append(rows, row)
		}

		n, err := client.UploadPrices(rows)
		if err != nil {
			logger.Warn("Upload lote %d: %v", i/batchSize+1, err)
			continue
		}
		total += n
		time.Sleep(200 * time.Millisecond)
	}

	logger.Info("%d preços enviados ao hub", total)
	return nil
}

func TriggerNow() {
	go func() {
		client := api.New()
		clientID := collector.EnsureClientID()
		watcher := collector.NewWatcher()
		sniffer := collector.NewPassiveSniffer()
		last := time.Time{}.Add(-config.GuildEvery)
		runCycle(client, clientID, watcher, sniffer, &last)
	}()
}

func shouldSyncPrices(clientID string) bool {
	last := lastPriceSync.Load()
	if last > 0 && time.Since(time.Unix(last, 0)) < config.PriceSyncEvery {
		return false
	}
	if config.PriceShardMod <= 1 {
		return true
	}
	return (simpleHash(clientID) % config.PriceShardMod) == 0
}

func simpleHash(v string) int {
	h := 0
	for i := 0; i < len(v); i++ {
		h = (h*31 + int(v[i])) & 0x7fffffff
	}
	return h
}

func derivePassiveGameplayObservations(netObs []api.Observation) []api.Observation {
	out := make([]api.Observation, 0, 2)
	now := time.Now().UTC().Format(time.RFC3339)

	for _, obs := range netObs {
		if obs.Type != "net_udp_packets" {
			continue
		}
		packets := int(obs.ValueNumeric)
		bytesTotal := 0
		if obs.Payload != nil {
			if v, ok := obs.Payload["bytes_total"]; ok {
				switch t := v.(type) {
				case int:
					bytesTotal = t
				case int64:
					bytesTotal = int(t)
				case float64:
					bytesTotal = int(t)
				}
			}
		}

		// Heurística: tráfego UDP alto em curto intervalo durante sessão ativa.
		if packets >= 40 && bytesTotal >= 12000 {
			estimatedFame := float64(packets * 150)
			estimatedKills := float64(packets / 45)
			if estimatedKills < 1 {
				estimatedKills = 1
			}

			out = append(out, api.Observation{
				Type:         "pve_fame",
				ObservedAt:   now,
				ValueNumeric: estimatedFame,
				Payload: map[string]any{
					"source":      "passive_network_heuristic",
					"target_key":  "pve_fame",
					"packets":     packets,
					"bytes_total": bytesTotal,
				},
			})

			// Também gera "mob_kill" para missões PvE de qualquer mob.
			out = append(out, api.Observation{
				Type:         "mob_kill",
				ObservedAt:   now,
				ValueNumeric: estimatedKills,
				Payload: map[string]any{
					"source":      "passive_network_heuristic",
					"target_key":  "mob_kill",
					"packets":     packets,
					"bytes_total": bytesTotal,
				},
			})
		}
	}

	return out
}

func deriveDynamicMobKillsFromFame(observations []api.Observation, thresholds []int) []api.Observation {
	if len(observations) == 0 || len(thresholds) == 0 {
		return nil
	}

	out := make([]api.Observation, 0, 2)
	for _, obs := range observations {
		if obs.Type != "pve_fame" && obs.Type != "fame" {
			continue
		}

		// Ignora sinais sintéticos de rede (já têm heurística própria de mob_kill).
		if obs.Payload != nil {
			if source, ok := obs.Payload["source"].(string); ok && strings.Contains(source, "passive_network_heuristic") {
				continue
			}
		}

		delta := 0
		prevTotal := int64(0)
		currentTotal := int64(obs.ValueNumeric)

		if obs.Payload != nil {
			if explicitDelta, ok := numberFromAny(obs.Payload["fame_delta"]); ok && explicitDelta > 0 {
				delta = explicitDelta
			}
			if payloadCurrent, ok := numberFromAny(obs.Payload["fame_current"]); ok && payloadCurrent > 0 {
				currentTotal = int64(payloadCurrent)
			}
		}

		if delta == 0 {
			if currentTotal <= 0 {
				continue
			}
			prevTotal = lastPveFameSnapshot.Load()
			if prevTotal <= 0 {
				lastPveFameSnapshot.Store(currentTotal)
				continue
			}
			if currentTotal <= prevTotal {
				lastPveFameSnapshot.Store(currentTotal)
				continue
			}
			delta = int(currentTotal - prevTotal)
			lastPveFameSnapshot.Store(currentTotal)
		}

		if delta <= 0 {
			continue
		}

		matches := make([]int, 0, len(thresholds))
		for _, threshold := range thresholds {
			if delta >= threshold {
				matches = append(matches, threshold)
			}
		}
		if len(matches) == 0 {
			continue
		}

		payload := map[string]any{
			"source":             "fame_delta_dynamic_threshold",
			"target_key":         "mob_kill",
			"fame_delta":         delta,
			"fame_previous":      prevTotal,
			"fame_current":       currentTotal,
			"matched_thresholds": matches,
		}
		if obs.Payload != nil {
			if actor, ok := obs.Payload["character"]; ok {
				payload["character"] = actor
			}
			if raw, ok := obs.Payload["raw"]; ok {
				payload["raw"] = raw
			}
		}

		out = append(out, api.Observation{
			Type:         "mob_kill",
			ObservedAt:   time.Now().UTC().Format(time.RFC3339),
			ValueNumeric: 1,
			Payload:      payload,
		})
	}

	return out
}

func numberFromAny(v any) (int, bool) {
	switch t := v.(type) {
	case int:
		return t, true
	case int32:
		return int(t), true
	case int64:
		return int(t), true
	case float32:
		return int(t), true
	case float64:
		return int(t), true
	case string:
		var n int
		if _, err := fmt.Sscanf(strings.TrimSpace(t), "%d", &n); err == nil {
			return n, true
		}
	}
	return 0, false
}
