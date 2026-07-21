package collector

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
)

func EnsureClientID() string {
	base := ResolvedStorageDir(ResolveAlbionName())
	_ = os.MkdirAll(base, 0o755)
	path := filepath.Join(base, "client-id.txt")

	legacyPath := filepath.Join(os.Getenv("LOCALAPPDATA"), "VENUM-Celeste", "client-id.txt")
	rootLegacy := filepath.Join(appBaseDir(), "client-id.txt")

	if raw, err := os.ReadFile(path); err == nil {
		val := strings.TrimSpace(string(raw))
		if val != "" {
			return normalizeClientID(val, path)
		}
	}

	// Migração: raiz legada → pasta ativa (perfil/personagem).
	if raw, err := os.ReadFile(rootLegacy); err == nil {
		val := strings.TrimSpace(string(raw))
		if val != "" {
			val = normalizeClientIDValue(val)
			_ = os.WriteFile(path, []byte(val), 0o600)
			return val
		}
	}

	if raw, err := os.ReadFile(legacyPath); err == nil {
		val := strings.TrimSpace(string(raw))
		if val != "" {
			val = normalizeClientIDValue(val)
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

func normalizeClientID(val, path string) string {
	out := normalizeClientIDValue(val)
	if out != val {
		_ = os.WriteFile(path, []byte(out), 0o600)
	}
	return out
}

func normalizeClientIDValue(val string) string {
	if strings.HasPrefix(val, "celeste-") {
		return "anaconda-" + strings.TrimPrefix(val, "celeste-")
	}
	return val
}
