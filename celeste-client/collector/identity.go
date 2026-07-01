package collector

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
)

func EnsureClientID() string {
	base := filepath.Join(os.Getenv("LOCALAPPDATA"), "VENUM-Celeste")
	_ = os.MkdirAll(base, 0o755)
	path := filepath.Join(base, "client-id.txt")

	if raw, err := os.ReadFile(path); err == nil {
		val := strings.TrimSpace(string(raw))
		if val != "" {
			return val
		}
	}

	b := make([]byte, 12)
	_, _ = rand.Read(b)
	id := "celeste-" + hex.EncodeToString(b)
	_ = os.WriteFile(path, []byte(id), 0o600)
	return id
}
