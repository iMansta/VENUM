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
//  2. Arquivo persistido albion-name.txt em %LOCALAPPDATA%/VENUM-Anaconda.
//  3. Nome detectado automaticamente dos logs do Albion (ator mais frequente).
//
// O nome do Windows (USERNAME) NÃO é usado como identidade de jogador porque
// raramente corresponde ao nome do personagem no Albion.

var (
	albionNameMu   sync.RWMutex
	albionNameOnce string
)

func albionNamePath() string {
	base := filepath.Join(os.Getenv("LOCALAPPDATA"), "VENUM-Anaconda")
	_ = os.MkdirAll(base, 0o755)
	return filepath.Join(base, "albion-name.txt")
}

// ResolveAlbionName retorna o nome do personagem Albion conhecido (env > arquivo).
// Retorna string vazia se ainda não foi possível identificar.
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
// Não sobrescreve um nome definido via ANACONDA_ALBION_NAME.
func PersistAlbionName(name string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return
	}
	if strings.TrimSpace(os.Getenv("ANACONDA_ALBION_NAME")) != "" {
		return
	}

	albionNameMu.Lock()
	changed := albionNameOnce != name
	albionNameOnce = name
	albionNameMu.Unlock()

	if changed {
		_ = os.WriteFile(albionNamePath(), []byte(name), 0o600)
	}
}
