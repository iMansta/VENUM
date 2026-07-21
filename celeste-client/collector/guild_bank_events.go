package collector

import (
	"strings"
	"time"
)

// Handlers Photon para saldo do banco da guilda.
//
// EventCodes de referência (StatisticsAnalysis, sujeito a patch):
//   - GuildVaultInfo     = 389  (abre UI / metadados do vault)
//   - GuildAccountLogEvent = 395  (logs da conta guilda)
//   - NewSimpleItem      = 37   (pilhas incl. prata)
//
// OperationCodes relevantes:
//   - ContainerOpen      = 92
//
// Configure via ANACONDA_GUILD_VAULT_EVENT_CODE quando um dump de rede
// revelar valores diferentes.

const (
	opContainerOpen = byte(92)
)

func (s *PassiveSniffer) handleGuildBankPhotonEvent(code byte, params map[byte]interface{}) {
	eventCode := photonEventCode(code, params)

	if guildBankDebugEnabled() && (eventCode == GuildVaultEventCode || eventCode == PhotonCodeGuildBankUpdate || s.guildBankSessionActive()) {
		logGuildBankDebug("photon_event", map[string]any{
			"eventCode": eventCode,
			"rawCode":   int16(code),
			"params":    photonParamSummary(params),
		})
	}

	// Caminho plugável: EventCode + chave de prata configuráveis via env.
	if eventCode == PhotonCodeGuildBankUpdate {
		s.beginGuildBankSession("photon_event:plugable_guild_bank", eventCode)
		if bankEvent, ok := ParseGuildBankUpdate(params); ok {
			s.recordGuildBankEvent(*bankEvent, "photon_event:plugable_guild_bank", "param_key")
			return
		}
	}

	switch eventCode {
	case GuildVaultEventCode:
		s.maybeRecordGuildBankSilver(eventCode, "photon_event:guild_vault_info", params)
		// GuildVaultInfo traz metadados; saldo pode vir em evento subsequente na mesma sessão.
	case GuildAccountLogEventCode:
		s.maybeRecordGuildBankSilver(eventCode, "photon_event:guild_account_log", params)
	case NewSimpleItemEventCode:
		if s.guildBankSessionActive() {
			s.maybeRecordGuildBankSilver(eventCode, "photon_event:new_simple_item", params)
		}
	default:
		if s.guildBankSessionActive() {
			s.maybeRecordGuildBankSilver(eventCode, "photon_event:session_scan", params)
		}
	}
}

func (s *PassiveSniffer) handleGuildBankPhotonResponse(opCode byte, params map[byte]interface{}) {
	if params == nil {
		return
	}

	// OperationResponse usa param 253 como opcode real em Protocol18.
	resolvedOp := int16(opCode)
	if v, ok := params[253]; ok {
		resolvedOp = int16(photonInt64Value(v))
	}

	if guildBankDebugEnabled() && (resolvedOp == int16(opContainerOpen) || s.guildBankSessionActive()) {
		logGuildBankDebug("photon_response", map[string]any{
			"operationCode": resolvedOp,
			"rawOpCode":     int16(opCode),
			"params":        photonParamSummary(params),
		})
	}

	switch resolvedOp {
	case int16(opContainerOpen):
		s.beginGuildBankSession("photon_response:container_open", resolvedOp)
		s.maybeRecordGuildBankSilver(resolvedOp, "photon_response:container_open", params)
	default:
		if s.guildBankSessionActive() {
			s.maybeRecordGuildBankSilver(resolvedOp, "photon_response:session_scan", params)
		}
	}
}

func (s *PassiveSniffer) handleGuildBankRawPayload(payload []byte) {
	if !s.guildBankSessionActive() || len(payload) == 0 {
		return
	}
	if silver := scanPayloadForSilverFixpoint(payload); silver > 0 {
		s.mu.Lock()
		defer s.mu.Unlock()
		if s.guildBankSession != nil &&
			s.guildBankSession.lastEmitted == silver &&
			time.Since(s.guildBankSession.lastEmitAt) < guildBankClientDedupe {
			return
		}
		s.guildBankReadings = append(s.guildBankReadings, GuildBankReading{
			SilverBalance: silver,
			ObservedAt:    time.Now().UTC(),
			EventCode:     -1,
			Source:        "raw_payload_heuristic",
			Confidence:    "byte_scan",
			RawHint:       map[string]any{"payloadLen": len(payload)},
		})
		if g := strings.TrimSpace(s.detectedGuild); g != "" {
			s.guildBankReadings[len(s.guildBankReadings)-1].GuildID = g
		}
		if s.guildBankSession == nil {
			s.guildBankSession = &guildBankSession{}
		}
		s.guildBankSession.lastEmitted = silver
		s.guildBankSession.lastEmitAt = time.Now()

		guildID := strings.TrimSpace(s.detectedGuild)
		pushGuildBankEvent(GuildBankEvent{
			SilverBalance: silver,
			EventCode:     -1,
			GuildID:       guildID,
		})
	}
}
