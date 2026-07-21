package collector

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/venum-i/anaconda/logger"
)

// GuildBankReading representa um saldo de prata do banco da guilda detectado
// passivamente via Photon (UDP 5056).
type GuildBankReading struct {
	SilverBalance int64
	ObservedAt    time.Time
	EventCode     int16
	Source        string
	GuildID       string
	Confidence    string
	RawHint       map[string]any
}

// Configuração plugável de EventCodes Photon (Albion Protocol18).
// Valores baseados em Triky313/AlbionOnline-StatisticsAnalysis (Jul/2026).
// Podem mudar a cada patch — sobrescreva via variáveis de ambiente.
var (
	// GuildVaultEventCode dispara sessão de leitura ao abrir banco da guilda.
	GuildVaultEventCode int16 = envInt16("ANACONDA_GUILD_VAULT_EVENT_CODE", 389)
	// GuildAccountLogEventCode pode carregar movimentações/saldo (opcional).
	GuildAccountLogEventCode int16 = envInt16("ANACONDA_GUILD_ACCOUNT_LOG_EVENT_CODE", 395)
	// NewSimpleItemEventCode — pilhas de prata aparecem como item simples.
	NewSimpleItemEventCode int16 = envInt16("ANACONDA_NEW_SIMPLE_ITEM_EVENT_CODE", 37)

	// Chaves Photon preferenciais onde o saldo costuma aparecer (fixpoint ou raw).
	guildBankSilverParamKeys = []byte{1, 3, 5, 2, 4, 0}
)

const (
	guildBankSessionTTL     = 25 * time.Second
	guildBankClientDedupe   = 45 * time.Second
	minGuildSilverFixpoint  = int64(10_000)        // 1 silver em fixpoint Albion
	maxGuildSilverFixpoint  = int64(1_000_000_000_000_000) // ~100M silver display
	fixpointPerSilver       = int64(10_000)
)

type guildBankSession struct {
	activeUntil time.Time
	lastEmitted int64
	lastEmitAt  time.Time
}

func envInt16(key string, fallback int16) int16 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	n, err := strconv.ParseInt(raw, 10, 16)
	if err != nil {
		return fallback
	}
	return int16(n)
}

func guildBankDebugEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("ANACONDA_GUILD_BANK_DEBUG")))
	return v == "1" || v == "true" || v == "yes"
}

// GuildBankDebugEnabled indica se o log [GuildBankDebug] está ativo.
func GuildBankDebugEnabled() bool {
	return guildBankDebugEnabled()
}

func logGuildBankDebug(action string, fields map[string]any) {
	if !guildBankDebugEnabled() {
		return
	}
	if fields == nil {
		fields = map[string]any{}
	}
	fields["action"] = action
	fields["at"] = time.Now().UTC().Format(time.RFC3339)
	raw, err := json.Marshal(fields)
	if err != nil {
		logger.Info("[GuildBankDebug] %s (marshal err: %v)", action, err)
		return
	}
	logger.Info("[GuildBankDebug] %s", string(raw))
}

// beginGuildBankSession marca janela ativa após GuildVaultInfo / ContainerOpen guilda.
func (s *PassiveSniffer) beginGuildBankSession(source string, eventCode int16) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.guildBankSession == nil {
		s.guildBankSession = &guildBankSession{}
	}
	s.guildBankSession.activeUntil = time.Now().Add(guildBankSessionTTL)
	logGuildBankDebug("session_start", map[string]any{
		"source":    source,
		"eventCode": eventCode,
	})
}

func (s *PassiveSniffer) guildBankSessionActive() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.guildBankSession == nil {
		return false
	}
	return time.Now().Before(s.guildBankSession.activeUntil)
}

// DrainGuildBankReadings retorna leituras pendentes e limpa o buffer interno.
func (s *PassiveSniffer) DrainGuildBankReadings() []GuildBankReading {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.guildBankReadings) == 0 {
		return nil
	}
	out := make([]GuildBankReading, len(s.guildBankReadings))
	copy(out, s.guildBankReadings)
	s.guildBankReadings = nil
	return out
}

func (s *PassiveSniffer) maybeRecordGuildBankSilver(
	eventCode int16,
	source string,
	params map[byte]interface{},
) {
	if params == nil {
		return
	}

	isVaultOpen := eventCode == GuildVaultEventCode
	if isVaultOpen {
		s.beginGuildBankSession(source, eventCode)
	}

	if !isVaultOpen && !s.guildBankSessionActive() {
		return
	}

	balance, confidence, hint := extractGuildBankSilver(eventCode, params)
	if balance <= 0 {
		if isVaultOpen || s.guildBankSessionActive() {
			logGuildBankDebug("scan_miss", map[string]any{
				"source":    source,
				"eventCode": eventCode,
				"params":    photonParamSummary(params),
			})
		}
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.guildBankSession == nil {
		s.guildBankSession = &guildBankSession{}
	}
	if !isVaultOpen && time.Now().After(s.guildBankSession.activeUntil) {
		return
	}

	// Dedup local: evita flood de POST antes da RPC deduplicar.
	if s.guildBankSession.lastEmitted == balance &&
		time.Since(s.guildBankSession.lastEmitAt) < guildBankClientDedupe {
		return
	}

	reading := GuildBankReading{
		SilverBalance: balance,
		ObservedAt:    time.Now().UTC(),
		EventCode:     eventCode,
		Source:        source,
		Confidence:    confidence,
		RawHint:       hint,
	}
	if g := strings.TrimSpace(s.detectedGuild); g != "" {
		reading.GuildID = g
	}

	s.guildBankReadings = append(s.guildBankReadings, reading)
	s.guildBankSession.lastEmitted = balance
	s.guildBankSession.lastEmitAt = time.Now()
	s.guildBankSession.activeUntil = time.Now().Add(guildBankSessionTTL)

	pushGuildBankEvent(GuildBankEvent{
		SilverBalance: balance,
		EventCode:     eventCode,
		GuildID:       reading.GuildID,
	})

	logGuildBankDebug("reading", map[string]any{
		"source":    source,
		"eventCode": eventCode,
		"balance":   balance,
		"confidence": confidence,
		"hint":      hint,
	})
}

// recordGuildBankEvent persiste leitura plugável e notifica o canal assíncrono.
func (s *PassiveSniffer) recordGuildBankEvent(ev GuildBankEvent, source, confidence string) {
	if ev.SilverBalance <= 0 {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.guildBankSession == nil {
		s.guildBankSession = &guildBankSession{}
	}
	if s.guildBankSession.lastEmitted == ev.SilverBalance &&
		time.Since(s.guildBankSession.lastEmitAt) < guildBankClientDedupe {
		return
	}

	reading := GuildBankReading{
		SilverBalance: ev.SilverBalance,
		ObservedAt:    time.Now().UTC(),
		EventCode:     ev.EventCode,
		Source:        source,
		Confidence:    confidence,
	}
	if ev.GuildID != "" {
		reading.GuildID = ev.GuildID
	} else if g := strings.TrimSpace(s.detectedGuild); g != "" {
		reading.GuildID = g
		ev.GuildID = g
	}

	s.guildBankReadings = append(s.guildBankReadings, reading)
	s.guildBankSession.lastEmitted = ev.SilverBalance
	s.guildBankSession.lastEmitAt = time.Now()
	s.guildBankSession.activeUntil = time.Now().Add(guildBankSessionTTL)

	pushGuildBankEvent(ev)
}

// extractGuildBankSilver tenta extrair saldo de prata dos parâmetros Photon.
// Retorna (balance, confidence, hint).
func extractGuildBankSilver(eventCode int16, params map[byte]interface{}) (int64, string, map[string]any) {
	hint := map[string]any{"eventCode": eventCode}

	// 0) Chave plugável (ParseGuildBankUpdate).
	if parsed, ok := ParseGuildBankUpdate(params); ok {
		hint["paramKey"] = GuildBankSilverKey
		hint["plugable"] = true
		return parsed.SilverBalance, "plugable_key", hint
	}

	// 1) Chaves preferenciais (mesmo padrão de UpdateMoney: param 1 = fixpoint).
	for _, key := range guildBankSilverParamKeys {
		if v, ok := params[key]; ok {
			if silver := fixpointOrRawToSilver(v); silver > 0 {
				hint["paramKey"] = key
				hint["rawValue"] = photonInt64Value(v)
				return silver, "param_key", hint
			}
		}
	}

	// 2) NewSimpleItem: quantity * stack durante sessão de guild vault.
	if eventCode == NewSimpleItemEventCode {
		qty := photonInt64(params, 2)
		itemID := photonInt64(params, 1)
		if qty > 0 && isLikelySilverItemID(itemID) {
			hint["itemId"] = itemID
			hint["quantity"] = qty
			return qty, "simple_item", hint
		}
	}

	// 3) Varredura heurística em todos os parâmetros (fallback para dump desconhecido).
	var best int64
	var bestKey byte
	for k, v := range params {
		if k == photonParamEventCode {
			continue
		}
		if silver := fixpointOrRawToSilver(v); silver > best {
			best = silver
			bestKey = k
		}
	}
	if best > 0 {
		hint["paramKey"] = bestKey
		hint["heuristic"] = true
		return best, "heuristic_scan", hint
	}

	return 0, "", hint
}

func fixpointOrRawToSilver(v interface{}) int64 {
	n := photonInt64Value(v)
	if n <= 0 {
		return 0
	}

	// Fixpoint Albion (interno * 10000).
	if n >= minGuildSilverFixpoint && n <= maxGuildSilverFixpoint && n%fixpointPerSilver == 0 {
		return n / fixpointPerSilver
	}

	// Valor já em prata display (ex.: contadores menores).
	if n >= 1 && n < minGuildSilverFixpoint {
		return n
	}

	// Fixpoint não múltiplo exato — arredonda para baixo.
	if n >= minGuildSilverFixpoint && n <= maxGuildSilverFixpoint {
		return n / fixpointPerSilver
	}

	return 0
}

func isLikelySilverItemID(itemID int64) bool {
	// SILVER no cliente Albion costuma ser index baixo; configurável para dumps futuros.
	if v := strings.TrimSpace(os.Getenv("ANACONDA_SILVER_ITEM_ID")); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err == nil && n == itemID {
			return true
		}
	}
	// Heurística conservadora: ids negativos pequenos (ex. TakeSilver usa -57).
	return itemID < 0 && itemID > -1000
}

func photonParamSummary(params map[byte]interface{}) map[string]any {
	out := map[string]any{}
	for k, v := range params {
		switch t := v.(type) {
		case string:
			if len(t) > 80 {
				out[strconv.Itoa(int(k))] = t[:80] + "..."
			} else {
				out[strconv.Itoa(int(k))] = t
			}
		case int64, int32, int16, int, uint64, uint32, uint16, uint8, float64, float32, bool:
			out[strconv.Itoa(int(k))] = v
		default:
			out[strconv.Itoa(int(k))] = "<complex>"
		}
	}
	return out
}

// scanPayloadForSilverFixpoint busca int64 little-endian em payload bruto (fallback).
func scanPayloadForSilverFixpoint(payload []byte) int64 {
	if len(payload) < 8 {
		return 0
	}
	var best int64
	for i := 0; i <= len(payload)-8; i++ {
		n := int64(uint64(payload[i]) |
			uint64(payload[i+1])<<8 |
			uint64(payload[i+2])<<16 |
			uint64(payload[i+3])<<24 |
			uint64(payload[i+4])<<32 |
			uint64(payload[i+5])<<40 |
			uint64(payload[i+6])<<48 |
			uint64(payload[i+7])<<56)
		if silver := fixpointOrRawToSilver(n); silver > best {
			best = silver
		}
	}
	return best
}
