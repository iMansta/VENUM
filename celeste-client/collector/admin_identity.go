package collector

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
)

func adminBaseDir() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "VENUM-Anaconda-Admin")
}

func EnsureAdminClientID() string {
	base := adminBaseDir()
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
	id := "anaconda-admin-" + hex.EncodeToString(b)
	_ = os.WriteFile(path, []byte(id), 0o600)
	return id
}

func SavePairingToken(token string) error {
	base := adminBaseDir()
	_ = os.MkdirAll(base, 0o755)
	path := filepath.Join(base, "pairing-token.txt")
	return os.WriteFile(path, []byte(strings.TrimSpace(strings.ToUpper(token))), 0o600)
}

func LoadPairingToken() string {
	path := filepath.Join(adminBaseDir(), "pairing-token.txt")
	raw, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(strings.ToUpper(string(raw)))
}
