package collector

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	maxQueueBytes = 5 * 1024 * 1024
	maxQueueLines = 10000
)

var queueMu sync.Mutex

func queuePath() string {
	return filepath.Join(appBaseDir(), "pending-telemetry.jsonl")
}

// EnqueueTelemetry persiste um payload para reenvio quando o hub estiver offline.
func EnqueueTelemetry(payload any) error {
	queueMu.Lock()
	defer queueMu.Unlock()

	if err := trimQueueIfNeeded(); err != nil {
		return err
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	f, err := os.OpenFile(queuePath(), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.Write(append(raw, '\n'))
	return err
}

func trimQueueIfNeeded() error {
	info, err := os.Stat(queuePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if info.Size() <= maxQueueBytes {
		return nil
	}

	raw, err := os.ReadFile(queuePath())
	if err != nil {
		return err
	}
	lines := splitNonEmptyLines(string(raw))
	if len(lines) <= maxQueueLines/2 {
		return nil
	}
	keep := lines[len(lines)-maxQueueLines/2:]
	return os.WriteFile(queuePath(), []byte(strings.Join(keep, "\n")+"\n"), 0o600)
}

func splitNonEmptyLines(s string) []string {
	var out []string
	scanner := bufio.NewScanner(strings.NewReader(s))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			out = append(out, line)
		}
	}
	return out
}

// PendingTelemetryCount retorna quantos lotes aguardam reenvio.
func PendingTelemetryCount() int {
	queueMu.Lock()
	defer queueMu.Unlock()
	raw, err := os.ReadFile(queuePath())
	if err != nil {
		return 0
	}
	return len(splitNonEmptyLines(string(raw)))
}

// DrainTelemetryQueue lê lotes pendentes sem removê-los.
func DrainTelemetryQueue(limit int) ([][]byte, error) {
	queueMu.Lock()
	defer queueMu.Unlock()

	raw, err := os.ReadFile(queuePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	lines := splitNonEmptyLines(string(raw))
	if limit > 0 && len(lines) > limit {
		lines = lines[:limit]
	}
	out := make([][]byte, 0, len(lines))
	for _, line := range lines {
		out = append(out, []byte(line))
	}
	return out, nil
}

// CommitTelemetryQueue remove as N primeiras entradas já enviadas com sucesso.
func CommitTelemetryQueue(sent int) error {
	queueMu.Lock()
	defer queueMu.Unlock()

	raw, err := os.ReadFile(queuePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	lines := splitNonEmptyLines(string(raw))
	if sent <= 0 {
		return nil
	}
	if sent >= len(lines) {
		return os.Remove(queuePath())
	}
	remaining := lines[sent:]
	if len(remaining) == 0 {
		return os.Remove(queuePath())
	}
	return os.WriteFile(queuePath(), []byte(strings.Join(remaining, "\n")+"\n"), 0o600)
}
