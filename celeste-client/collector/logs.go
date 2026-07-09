package collector

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/venum-i/anaconda/api"
)

type Watcher struct {
	path              string
	offset            int64
	warnedNoLog       bool
	warnedPlayerLog   bool
	playerLogWarnedAt bool
}

var ErrGameLogNotFound = errors.New("albion game.log nao encontrado")

var numberRx = regexp.MustCompile(`(\d[\d\.,]*)`)
var compactNumberRx = regexp.MustCompile(`(\d+(?:[\.,]\d+)?)\s*([mk])\b`)
var killTargetRx = regexp.MustCompile(`(?:killed|slain|matou)\s+([A-Za-z0-9_\- 'À-ÿ]+)`)
var actorPrefixRx = regexp.MustCompile(`^([A-Za-z0-9_\-]+)\s+(?:killed|slain|matou)\b`)

func NewWatcher() *Watcher {
	return &Watcher{}
}

func (w *Watcher) Path() string {
	return w.path
}

func (w *Watcher) DetectPath() string {
	if w.path != "" {
		if _, err := os.Stat(w.path); err == nil {
			return w.path
		}
		w.path = ""
		w.offset = 0
	}

	candidates := []string{
		os.Getenv("ANACONDA_LOG_PATH"),
		os.Getenv("CELESTE_LOG_PATH"),
		filepath.Join(os.Getenv("USERPROFILE"), "Documents", "Albion Online", "game.log"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Albion Online", "game.log"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Albion Online Client", "game.log"),
		filepath.Join(os.Getenv("USERPROFILE"), "AppData", "LocalLow", "Sandbox Interactive GmbH", "Albion Online", "game.log"),
		filepath.Join(os.Getenv("USERPROFILE"), "AppData", "LocalLow", "Sandbox Interactive GmbH", "Albion Online Client", "game.log"),
		filepath.Join(os.Getenv("USERPROFILE"), "AppData", "LocalLow", "Sandbox Interactive GmbH", "Albion Online", "Player.log"),
		filepath.Join(os.Getenv("USERPROFILE"), "AppData", "LocalLow", "Sandbox Interactive GmbH", "Albion Online Client", "Player.log"),
	}

	for _, p := range candidates {
		if strings.TrimSpace(p) == "" {
			continue
		}
		if info, err := os.Stat(p); err == nil {
			w.path = p
			if w.offset == 0 {
				// Lê um trecho recente para captar eventos já ocorridos antes da inicialização.
				const recentWindow = int64(2 * 1024 * 1024)
				if info.Size() > recentWindow {
					w.offset = info.Size() - recentWindow
				} else {
					w.offset = 0
				}
			}
			w.warnedNoLog = false
			if strings.HasSuffix(strings.ToLower(p), "player.log") && !w.warnedPlayerLog {
				w.warnedPlayerLog = true
			}
			return p
		}
	}
	return ""
}

func (w *Watcher) ReadObservations(max int) ([]api.Observation, error) {
	logPath := w.DetectPath()
	if logPath == "" {
		if !w.warnedNoLog {
			w.warnedNoLog = true
		}
		return nil, ErrGameLogNotFound
	}

	f, err := os.Open(logPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	if info, statErr := f.Stat(); statErr == nil && w.offset > info.Size() {
		// Log rotacionado/truncado: reinicia leitura.
		w.offset = 0
	}

	if _, err := f.Seek(w.offset, 0); err != nil {
		return nil, err
	}

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 1024*64), 1024*1024)
	obs := make([]api.Observation, 0, max)

	for sc.Scan() {
		line := sc.Text()
		o, ok := parseLine(line)
		if !ok {
			continue
		}
		obs = append(obs, o)
		if len(obs) >= max {
			break
		}
	}

	pos, _ := f.Seek(0, 1)
	w.offset = pos
	if sc.Err() != nil {
		return obs, sc.Err()
	}
	return obs, nil
}

func (w *Watcher) IsPlayerLog() bool {
	return strings.HasSuffix(strings.ToLower(w.path), "player.log")
}

func (w *Watcher) ShouldWarnPlayerLog() bool {
	if !w.IsPlayerLog() {
		return false
	}
	if w.playerLogWarnedAt {
		return false
	}
	w.playerLogWarnedAt = true
	return true
}

func parseLine(line string) (api.Observation, bool) {
	raw := strings.TrimSpace(strings.ReplaceAll(line, "\x00", ""))
	if raw == "" {
		return api.Observation{}, false
	}

	low := strings.ToLower(raw)
	now := time.Now().UTC().Format(time.RFC3339)
	value := parseNumber(raw)
	targetName := detectTargetName(raw)
	targetKey := detectTargetKey(low)
	actor := detectActor(raw)

	switch {
	case strings.Contains(low, "fame") || strings.Contains(low, "fama"):
		oType := "fame"
		if strings.Contains(low, "pve") || strings.Contains(low, "mob") {
			oType = "pve_fame"
		}
		return api.Observation{
			Type:         oType,
			ObservedAt:   now,
			ValueNumeric: value,
			Payload: map[string]any{
				"raw":         raw,
				"target_key":  targetKey,
				"target_name": targetName,
				"character":   actor,
			},
		}, true
	case strings.Contains(low, "gather") || strings.Contains(low, "resource"):
		return api.Observation{
			Type:         "gathering",
			ObservedAt:   now,
			ValueNumeric: value,
			Payload: map[string]any{
				"raw":         raw,
				"target_key":  targetKey,
				"target_name": targetName,
				"character":   actor,
			},
		}, true
	case strings.Contains(low, "killed") || strings.Contains(low, "slain") || strings.Contains(low, "mob"):
		oType := "mob_kill"
		if strings.Contains(low, "player") || strings.Contains(low, "jogador") || strings.Contains(low, "foi morto por") {
			oType = "pvp_kill"
		}
		return api.Observation{
			Type:         oType,
			ObservedAt:   now,
			ValueNumeric: value,
			Payload: map[string]any{
				"raw":         raw,
				"target_key":  targetKey,
				"target_name": targetName,
				"character":   actor,
			},
		}, true
	case isBigChestLine(low):
		return api.Observation{
			Type:         "big_chest",
			ObservedAt:   now,
			ValueNumeric: 1,
			Payload: map[string]any{
				"raw":         raw,
				"target_key":  "big_chest",
				"target_name": targetName,
				"character":   actor,
				"scope":       "group",
			},
		}, true
	case strings.Contains(low, "outpost"):
		return api.Observation{
			Type:         "outpost_capture",
			ObservedAt:   now,
			ValueNumeric: 1,
			Payload: map[string]any{
				"raw":         raw,
				"target_key":  "outpost_capture",
				"target_name": targetName,
				"character":   actor,
				"scope":       "group",
			},
		}, true
	case strings.Contains(low, "castle") || strings.Contains(low, "castelo"):
		return api.Observation{
			Type:         "castle_capture",
			ObservedAt:   now,
			ValueNumeric: 1,
			Payload: map[string]any{
				"raw":         raw,
				"target_key":  "castle_capture",
				"target_name": targetName,
				"character":   actor,
				"scope":       "group",
			},
		}, true
	case strings.Contains(low, "mission"):
		return api.Observation{
			Type:       "mission",
			ObservedAt: now,
			Payload: map[string]any{
				"raw":         raw,
				"target_key":  targetKey,
				"target_name": targetName,
				"character":   actor,
			},
		}, true
	default:
		return api.Observation{}, false
	}
}

// isBigChestLine detecta abertura de baús grandes (dourado/verde/azul/roxo) para
// objetivos de grupo. Ignora baús comuns para reduzir ruído.
func isBigChestLine(low string) bool {
	if !strings.Contains(low, "chest") && !strings.Contains(low, "baú") && !strings.Contains(low, "bau") {
		return false
	}
	keywords := []string{
		"big chest", "large chest", "golden chest", "gold chest",
		"green chest", "blue chest", "purple chest", "legendary chest",
		"baú grande", "bau grande", "baú dourado", "bau dourado",
	}
	for _, k := range keywords {
		if strings.Contains(low, k) {
			return true
		}
	}
	return false
}

func parseNumber(line string) float64 {
	if m := compactNumberRx.FindStringSubmatch(strings.ToLower(line)); len(m) == 3 {
		n := strings.ReplaceAll(m[1], ",", ".")
		val := 0.0
		dotSeen := false
		frac := 0.1
		for _, ch := range n {
			if ch == '.' && !dotSeen {
				dotSeen = true
				continue
			}
			if ch < '0' || ch > '9' {
				continue
			}
			if dotSeen {
				val += float64(ch-'0') * frac
				frac *= 0.1
			} else {
				val = val*10 + float64(ch-'0')
			}
		}
		switch m[2] {
		case "m":
			return val * 1_000_000
		case "k":
			return val * 1_000
		}
	}

	m := numberRx.FindStringSubmatch(line)
	if len(m) < 2 {
		return 0
	}
	n := strings.ReplaceAll(m[1], ".", "")
	n = strings.ReplaceAll(n, ",", "")
	var out float64
	for _, ch := range n {
		if ch < '0' || ch > '9' {
			return 0
		}
		out = out*10 + float64(ch-'0')
	}
	return out
}

func detectTargetKey(low string) string {
	n := normalizeKey(low)
	switch {
	case strings.Contains(n, "mago engarrafado"), strings.Contains(n, "bottled mage"):
		return "bottled_mage"
	case strings.Contains(n, "cristal"), strings.Contains(n, "crystal"):
		return "crystal_mob"
	case strings.Contains(n, "boss"):
		return "world_boss"
	case strings.Contains(n, "player"), strings.Contains(n, "jogador"):
		return "player_kill"
	case strings.Contains(n, "fame"), strings.Contains(n, "fama"):
		return "pve_fame"
	case strings.Contains(n, "gather"), strings.Contains(n, "coleta"), strings.Contains(n, "resource"):
		return "gather_any"
	default:
		return ""
	}
}

func detectTargetName(raw string) string {
	if m := killTargetRx.FindStringSubmatch(raw); len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	return ""
}

func detectActor(raw string) string {
	if m := actorPrefixRx.FindStringSubmatch(raw); len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	if parts := strings.SplitN(raw, ":", 2); len(parts) == 2 {
		left := strings.TrimSpace(parts[0])
		if left != "" && !strings.Contains(strings.ToLower(left), "albion") {
			return left
		}
	}
	return ""
}

func normalizeKey(v string) string {
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "â", "a", "ã", "a",
		"é", "e", "ê", "e",
		"í", "i",
		"ó", "o", "ô", "o", "õ", "o",
		"ú", "u",
		"ç", "c",
	)
	return replacer.Replace(strings.ToLower(v))
}
