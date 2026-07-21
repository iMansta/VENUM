package collector

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func guildBankQueuePath() string {
	return filepath.Join(appBaseDir(), "pending-guild-bank.jsonl")
}

// EnqueueGuildBank persiste leitura para reenvio quando o hub estiver offline.
func EnqueueGuildBank(payload any) error {
	queueMu.Lock()
	defer queueMu.Unlock()

	if err := trimGuildBankQueueIfNeeded(); err != nil {
		return err
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	f, err := os.OpenFile(guildBankQueuePath(), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.Write(append(raw, '\n'))
	return err
}

func trimGuildBankQueueIfNeeded() error {
	info, err := os.Stat(guildBankQueuePath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if info.Size() <= maxQueueBytes {
		return nil
	}

	raw, err := os.ReadFile(guildBankQueuePath())
	if err != nil {
		return err
	}
	lines := splitNonEmptyLines(string(raw))
	if len(lines) <= maxQueueLines/2 {
		return nil
	}
	keep := lines[len(lines)-maxQueueLines/2:]
	return os.WriteFile(guildBankQueuePath(), []byte(joinLines(keep)), 0o600)
}

func joinLines(lines []string) string {
	if len(lines) == 0 {
		return ""
	}
	out := lines[0]
	for i := 1; i < len(lines); i++ {
		out += "\n" + lines[i]
	}
	return out + "\n"
}

// PendingGuildBankCount retorna quantas leituras aguardam reenvio.
func PendingGuildBankCount() int {
	queueMu.Lock()
	defer queueMu.Unlock()
	raw, err := os.ReadFile(guildBankQueuePath())
	if err != nil {
		return 0
	}
	return len(splitNonEmptyLines(string(raw)))
}

// DrainGuildBankQueue lê entradas pendentes sem removê-las.
func DrainGuildBankQueue(limit int) ([][]byte, error) {
	queueMu.Lock()
	defer queueMu.Unlock()

	raw, err := os.ReadFile(guildBankQueuePath())
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

// CommitGuildBankQueue remove as N primeiras entradas já enviadas com sucesso.
func CommitGuildBankQueue(sent int) error {
	queueMu.Lock()
	defer queueMu.Unlock()

	raw, err := os.ReadFile(guildBankQueuePath())
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
		return os.Remove(guildBankQueuePath())
	}
	remaining := lines[sent:]
	if len(remaining) == 0 {
		return os.Remove(guildBankQueuePath())
	}
	return os.WriteFile(guildBankQueuePath(), []byte(joinLines(remaining)), 0o600)
}
