package collector

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Identidade do jogador Albion (personagem in-game), usada para separar o
// progresso individual de cada usuário no hub.
//
// Ordem de resolução (silenciosa, sem exigir chave do usuário):
//  1. Variável de ambiente ANACONDA_ALBION_NAME (definida pelo instalador/usuário).
//  2. Arquivo persistido albion-name.txt na pasta ativa (perfil ou personagem).
//  3. Nome detectado automaticamente dos logs do Albion (ator mais frequente).
//
// O nome do Windows (USERNAME) NÃO é usado como identidade de jogador.

var (
	albionNameMu   sync.RWMutex
	albionNameOnce string
)

func albionNamePath() string {
	dir := activeAlbionStorageDir()
	_ = os.MkdirAll(dir, 0o755)
	return filepath.Join(dir, "albion-name.txt")
}

func activeAlbionStorageDir() string {
	return ResolvedStorageDir(currentCachedAlbionName())
}

func currentCachedAlbionName() string {
	albionNameMu.RLock()
	defer albionNameMu.RUnlock()
	return albionNameOnce
}

// ResolveAlbionName retorna o nome do personagem Albion conhecido (env > arquivo).
func ResolveAlbionName() string {
	if v := strings.TrimSpace(os.Getenv("ANACONDA_ALBION_NAME")); v != "" {
		return v
	}

	albionNameMu.RLock()
	cached := albionNameOnce
	albionNameMu.RUnlock()
	if cached != "" {
		return cached
	}

	if raw, err := os.ReadFile(albionNamePath()); err == nil {
		val := strings.TrimSpace(string(raw))
		if val != "" {
			albionNameMu.Lock()
			albionNameOnce = val
			albionNameMu.Unlock()
			return val
		}
	}
	return ""
}

// PersistAlbionName grava o nome detectado para uso nos próximos ciclos.
func PersistAlbionName(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	if strings.TrimSpace(os.Getenv("ANACONDA_ALBION_NAME")) != "" {
		return false
	}

	prev := ResolveAlbionName()
	changed := !strings.EqualFold(prev, name)

	albionNameMu.Lock()
	albionNameOnce = name
	albionNameMu.Unlock()

	if changed || prev == "" {
		_ = os.WriteFile(albionNamePath(), []byte(name), 0o600)
	}
	return changed
}
