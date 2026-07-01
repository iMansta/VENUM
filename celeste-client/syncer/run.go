package syncer

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/venum-i/celeste/api"
	"github.com/venum-i/celeste/config"
	"github.com/venum-i/celeste/logger"
)

var (
	running atomic.Bool
	paused  atomic.Bool
	lastOK  atomic.Int64
)

func IsPaused() bool  { return paused.Load() }
func LastOK() time.Time {
	t := lastOK.Load()
	if t == 0 {
		return time.Time{}
	}
	return time.Unix(t, 0)
}

func SetPaused(v bool) { paused.Store(v) }

func RunLoop(stop <-chan struct{}) {
	client := api.New()
	lastGuild := time.Time{}

	logger.Info("Celeste — guilda %s", config.GuildName)
	logger.Info("Hub: %s", config.APIBase)

	if err := client.Ping(); err != nil {
		logger.Error("Falha ao conectar ao hub: %v", err)
		logger.Warn("Verifique internet ou aguarde manutenção do servidor")
	} else {
		logger.Info("Conectado ao hub VENUM")
	}

	runCycle(client, &lastGuild)

	ticker := time.NewTicker(config.SyncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if !paused.Load() {
				runCycle(client, &lastGuild)
			}
		}
	}
}

func runCycle(client *api.Client, lastGuild *time.Time) {
	if !running.CompareAndSwap(false, true) {
		return
	}
	defer running.Store(false)

	if paused.Load() {
		return
	}

	start := time.Now()
	logger.Info("Iniciando ciclo de sincronização")

	if err := syncPrices(client); err != nil {
		logger.Error("Preços: %v", err)
	}

	if time.Since(*lastGuild) >= config.GuildEvery {
		if err := client.SyncGuild(); err != nil {
			logger.Error("Guilda: %v", err)
		} else {
			logger.Info("Membros da guilda sincronizados")
			*lastGuild = time.Now()
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
		last := time.Time{}.Add(-config.GuildEvery)
		runCycle(client, &last)
	}()
}
