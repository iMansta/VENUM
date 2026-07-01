package collector

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/venum-i/celeste/api"
)

type Watcher struct {
	path   string
	offset int64
}

var numberRx = regexp.MustCompile(`(\d[\d\.,]*)`)

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
		os.Getenv("CELESTE_LOG_PATH"),
		filepath.Join(os.Getenv("USERPROFILE"), "Documents", "Albion Online", "game.log"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Albion Online", "game.log"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Albion Online Client", "game.log"),
	}

	for _, p := range candidates {
		if strings.TrimSpace(p) == "" {
			continue
		}
		if _, err := os.Stat(p); err == nil {
			w.path = p
			w.offset = 0
			return p
		}
	}
	return ""
}

func (w *Watcher) ReadObservations(max int) ([]api.Observation, error) {
	logPath := w.DetectPath()
	if logPath == "" {
		return nil, nil
	}

	f, err := os.Open(logPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	if _, err := f.Seek(w.offset, 0); err != nil {
		return nil, err
	}

	sc := bufio.NewScanner(f)
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

func parseLine(line string) (api.Observation, bool) {
	raw := strings.TrimSpace(line)
	if raw == "" {
		return api.Observation{}, false
	}

	low := strings.ToLower(raw)
	now := time.Now().UTC().Format(time.RFC3339)
	value := parseNumber(raw)

	switch {
	case strings.Contains(low, "fame"):
		return api.Observation{
			Type:         "fame",
			ObservedAt:   now,
			ValueNumeric: value,
			Payload:      map[string]any{"raw": raw},
		}, true
	case strings.Contains(low, "gather") || strings.Contains(low, "resource"):
		return api.Observation{
			Type:         "gathering",
			ObservedAt:   now,
			ValueNumeric: value,
			Payload:      map[string]any{"raw": raw},
		}, true
	case strings.Contains(low, "killed") || strings.Contains(low, "slain") || strings.Contains(low, "mob"):
		return api.Observation{
			Type:         "mob_kill",
			ObservedAt:   now,
			ValueNumeric: value,
			Payload:      map[string]any{"raw": raw},
		}, true
	case strings.Contains(low, "mission"):
		return api.Observation{
			Type:       "mission",
			ObservedAt: now,
			Payload:    map[string]any{"raw": raw},
		}, true
	default:
		return api.Observation{}, false
	}
}

func parseNumber(line string) float64 {
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
