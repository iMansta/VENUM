package collector

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ProfileLink persiste o vínculo fixo entre a instalação Anaconda e o perfil VENUM.
type ProfileLink struct {
	ProfileID string `json:"profileId"`
	Username  string `json:"username"`
	LinkedAt  string `json:"linkedAt"`
}

func appBaseDir() string {
	base := filepath.Join(os.Getenv("LOCALAPPDATA"), "VENUM-Anaconda")
	_ = os.MkdirAll(base, 0o755)
	return base
}

func profileLinkPath() string {
	return filepath.Join(appBaseDir(), "profile-link.json")
}

// ActiveStorageDir retorna a pasta de dados ativa: por perfil pareado ou raiz legada.
func ActiveStorageDir() string {
	if link := LoadProfileLink(); link != nil && link.ProfileID != "" {
		dir := filepath.Join(appBaseDir(), "profiles", sanitizePathSegment(link.ProfileID))
		_ = os.MkdirAll(dir, 0o755)
		return dir
	}
	return appBaseDir()
}

func sanitizePathSegment(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return "unknown"
	}
	var b strings.Builder
	for _, r := range v {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			b.WriteRune(r)
		}
	}
	out := b.String()
	if out == "" {
		return "unknown"
	}
	return out
}

// LoadProfileLink lê o vínculo de perfil salvo localmente.
func LoadProfileLink() *ProfileLink {
	raw, err := os.ReadFile(profileLinkPath())
	if err != nil {
		return nil
	}
	var link ProfileLink
	if err := json.Unmarshal(raw, &link); err != nil {
		return nil
	}
	link.ProfileID = strings.TrimSpace(link.ProfileID)
	link.Username = strings.TrimSpace(link.Username)
	if link.ProfileID == "" {
		return nil
	}
	return &link
}

// SaveProfileLink grava o vínculo de perfil após pareamento bem-sucedido.
func SaveProfileLink(link ProfileLink) error {
	link.ProfileID = strings.TrimSpace(link.ProfileID)
	link.Username = strings.TrimSpace(link.Username)
	if link.ProfileID == "" {
		return os.ErrInvalid
	}
	if link.LinkedAt == "" {
		link.LinkedAt = time.Now().UTC().Format(time.RFC3339)
	}
	raw, err := json.MarshalIndent(link, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(profileLinkPath(), raw, 0o600)
}

// ClearProfileLink remove o vínculo local (troca de conta).
func ClearProfileLink() error {
	err := os.Remove(profileLinkPath())
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

// ResolvedStorageDir escolhe pasta de dados: perfil pareado > personagem > raiz.
func ResolvedStorageDir(albionName string) string {
	if link := LoadProfileLink(); link != nil {
		return ActiveStorageDir()
	}
	if strings.TrimSpace(albionName) != "" {
		return StorageDirForCharacter(albionName)
	}
	return appBaseDir()
}

// CharacterStorageKey identifica a pasta quando há troca de personagem sem perfil pareado.
func CharacterStorageKey(albionName string) string {
	name := strings.TrimSpace(albionName)
	if name == "" {
		return ""
	}
	return sanitizePathSegment(strings.ToLower(name))
}

// StorageDirForCharacter retorna subpasta por personagem quando não há perfil pareado.
func StorageDirForCharacter(albionName string) string {
	if link := LoadProfileLink(); link != nil {
		return ActiveStorageDir()
	}
	key := CharacterStorageKey(albionName)
	if key == "" {
		return appBaseDir()
	}
	dir := filepath.Join(appBaseDir(), "characters", key)
	_ = os.MkdirAll(dir, 0o755)
	return dir
}
