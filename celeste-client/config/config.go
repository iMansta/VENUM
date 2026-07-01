package config

import "time"

// Valores padrão — sobrescritos via -ldflags no build de release.
var (
	APIBase    = "https://venum-eight.vercel.app"
	AgentToken = "venum_celeste_bmdvk_7Xk9mP2wQ5nR8tY4vL6jH1sF3dA0cE"
	Version    = "1.0.0"
	GuildName  = "I V E N U M I"
)

const (
	AlbionDataBase = "https://west.albion-online-data.com"
	SyncInterval   = 15 * time.Minute
	GuildEvery     = 24 * time.Hour
)
