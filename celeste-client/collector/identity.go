package collector

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
)

func EnsureClientID() string {
	base := filepath.Join(os.Getenv("LOCALAPPDATA"), "VENUM-Anaconda")
	_ = os.MkdirAll(base, 0o755)
	path := filepath.Join(base, "client-id.txt")

	legacyPath := filepath.Join(os.Getenv("LOCALAPPDATA"), "VENUM-Celeste", "client-id.txt")

	if raw, err := os.ReadFile(path); err == nil {
		val := strings.TrimSpace(string(raw))
		if val != "" {
			if strings.HasPrefix(val, "celeste-") {
				val = "anaconda-" + strings.TrimPrefix(val, "celeste-")
				_ = os.WriteFile(path, []byte(val), 0o600)
			}
			return val
		}
	}

	// Migração transparente do namespace antigo.
	if raw, err := os.ReadFile(legacyPath); err == nil {
		val := strings.TrimSpace(string(raw))
		if val != "" {
			if strings.HasPrefix(val, "celeste-") {
				val = "anaconda-" + strings.TrimPrefix(val, "celeste-")
			}
			_ = os.WriteFile(path, []byte(val), 0o600)
			return val
		}
	}

	b := make([]byte, 12)
	_, _ = rand.Read(b)
	id := "anaconda-" + hex.EncodeToString(b)
	_ = os.WriteFile(path, []byte(id), 0o600)
	return id
}
