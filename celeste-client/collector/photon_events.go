package collector

import (
	"math"
	"time"

	"github.com/venum-i/anaconda/api"
)

// Códigos de evento Photon do Albion (Protocol18). Valores extraídos do
// protocolo público (albion-lens / albiondata-client).
const (
	photonParamEventCode   = byte(252)
	evUpdateFame           = int16(82)
	evKillRewardedNoFame   = int16(613)
	minTotalFameFixpoint   = int64(1_000_000) // ~100 fama em FixPoint
	fixpointPerFameDisplay = 10000.0
)

func photonEventCode(code byte, params map[byte]interface{}) int16 {
	if params != nil {
		if v, ok := params[photonParamEventCode]; ok {
			return int16(photonInt64Value(v))
		}
	}
	return int16(code)
}

func (s *PassiveSniffer) onPhotonEvent(code byte, params map[byte]interface{}) {
	if params == nil {
		return
	}
	switch photonEventCode(code, params) {
	case evUpdateFame:
		s.handlePhotonUpdateFame(params)
	case evKillRewardedNoFame:
		s.handlePhotonKillNoFame(params)
	}
}

func (s *PassiveSniffer) handlePhotonUpdateFame(params map[byte]interface{}) {
	totalFix := photonInt64(params, 1)
	if totalFix < minTotalFameFixpoint {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if totalFix == s.lastTotalFameFix {
		return
	}
	if s.lastTotalFameFix > 0 && totalFix < s.lastTotalFameFix {
		return
	}

	var gainedFix int64
	if v, ok := params[2]; ok {
		gainedFix = photonInt64Value(v)
	} else if s.lastTotalFameFix > 0 {
		gainedFix = totalFix - s.lastTotalFameFix
	}

	s.lastTotalFameFix = totalFix
	if gainedFix <= 0 {
		return
	}

	gainedDisplay := int(math.Floor(float64(gainedFix) / fixpointPerFameDisplay))
	if gainedDisplay <= 0 {
		return
	}

	totalDisplay := int(math.Floor(float64(totalFix) / fixpointPerFameDisplay))
	now := time.Now().UTC().Format(time.RFC3339)

	s.combatObs = append(s.combatObs, api.Observation{
		Type:         "pve_fame",
		ObservedAt:   now,
		ValueNumeric: float64(gainedDisplay),
		Payload: map[string]any{
			"source":              "photon_event",
			"target_key":          "pve_fame",
			"fame_delta":          gainedDisplay,
			"fame_current":        totalDisplay,
			"fame_fixpoint_delta": gainedFix,
		},
	})
}

func (s *PassiveSniffer) handlePhotonKillNoFame(params map[byte]interface{}) {
	// Kill sem fama (ex.: mobs muito fracos). Conta como mob_kill direto.
	_ = params
	now := time.Now().UTC().Format(time.RFC3339)

	s.mu.Lock()
	defer s.mu.Unlock()

	s.combatObs = append(s.combatObs, api.Observation{
		Type:         "mob_kill",
		ObservedAt:   now,
		ValueNumeric: 1,
		Payload: map[string]any{
			"source":     "photon_event",
			"target_key": "mob_kill",
			"fame_delta": 0,
		},
	})
}

func photonInt64(params map[byte]interface{}, key byte) int64 {
	if params == nil {
		return 0
	}
	return photonInt64Value(params[key])
}

func photonInt64Value(v interface{}) int64 {
	switch t := v.(type) {
	case int64:
		return t
	case int32:
		return int64(t)
	case int16:
		return int64(t)
	case int:
		return int64(t)
	case uint32:
		return int64(t)
	case uint16:
		return int64(t)
	case uint8:
		return int64(t)
	case float32:
		return int64(t)
	case float64:
		return int64(t)
	default:
		return 0
	}
}
