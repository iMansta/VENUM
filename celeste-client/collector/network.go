package collector

import (
	"fmt"
	"net"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/venum-i/anaconda/api"
	"github.com/venum-i/anaconda/collector/photon"
)

var likelyAlbionPorts = map[uint16]bool{
	5055: true,
	5056: true,
	5057: true,
	5058: true,
}

// opJoinResponse é o opcode da operação Join do Albion (Protocol18). A resposta
// (JoinResponse) traz o nome do personagem local no parâmetro 2 e a guilda no 58.
const opJoinResponse = byte(2)

type PassiveSniffer struct {
	mu           sync.Mutex
	localIPs     map[string]bool
	npCapChecked bool
	npCapReady   bool
	npCapErr     error

	photonParser  *photon.PhotonParser
	detectedChar  string
	detectedGuild string

	lastTotalFameFix int64
	combatObs        []api.Observation

	guildBankSession  *guildBankSession
	guildBankReadings []GuildBankReading
	guildBankDebug    []map[string]any
}

func NewPassiveSniffer() *PassiveSniffer {
	s := &PassiveSniffer{
		localIPs: collectLocalIPs(),
	}
	// Parser Photon dedicado a identificar silenciosamente o personagem local.
	s.photonParser = photon.NewPhotonParser(nil, s.onPhotonResponse, s.onPhotonEvent)
	return s
}

// onPhotonResponse captura o nome do personagem local a partir da resposta da
// operação Join. Não coleta dados de outros jogadores.
func (s *PassiveSniffer) onPhotonResponse(opCode byte, _ int16, _ string, params map[byte]interface{}) {
	if opCode == opJoinResponse && params != nil {
		name, _ := params[2].(string)
		name = strings.TrimSpace(name)
		if name != "" {
			guild, _ := params[58].(string)
			s.mu.Lock()
			s.detectedChar = name
			if g := strings.TrimSpace(guild); g != "" {
				s.detectedGuild = g
			}
			s.mu.Unlock()
		}
	}
	s.handleGuildBankPhotonResponse(opCode, params)
}

// DetectedCharacter retorna o nome do personagem Albion local identificado via
// Photon (Join), ou "" se ainda não foi observado.
func (s *PassiveSniffer) DetectedCharacter() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.detectedChar
}

// feedPhoton alimenta o parser Photon com um payload UDP, protegido contra
// pânico em pacotes malformados (degrada de forma silenciosa).
func (s *PassiveSniffer) feedPhoton(payload []byte) {
	if s.photonParser == nil || len(payload) == 0 {
		return
	}
	defer func() { _ = recover() }()
	buf := make([]byte, len(payload))
	copy(buf, payload)
	s.photonParser.ReceivePacket(buf)
}

func (s *PassiveSniffer) Status() (ready bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.npCapChecked {
		s.checkNpcapLocked()
	}
	return s.npCapReady, s.npCapErr
}

func (s *PassiveSniffer) CaptureWindow(window time.Duration, maxPackets int) ([]api.Observation, error) {
	s.mu.Lock()
	if !s.npCapChecked {
		s.checkNpcapLocked()
	}
	if !s.npCapReady {
		err := s.npCapErr
		s.mu.Unlock()
		return nil, err
	}
	s.mu.Unlock()

	devices, err := pcap.FindAllDevs()
	if err != nil {
		return nil, err
	}
	dev := pickCaptureDevice(devices)
	if dev == nil {
		return nil, fmt.Errorf("nenhuma interface de rede válida para captura")
	}

	handle, err := pcap.OpenLive(dev.Name, 1600, true, 500*time.Millisecond)
	if err != nil {
		return nil, err
	}
	defer handle.Close()

	_ = handle.SetBPFFilter("udp port 5056")

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	packetSource.NoCopy = true

	s.mu.Lock()
	s.combatObs = nil
	s.mu.Unlock()

	deadline := time.Now().Add(window)
	totalPackets := 0
	totalBytes := 0
	albionPackets := 0
	albionBytes := 0
	inbound := 0
	outbound := 0
	topPorts := map[uint16]int{}

	for time.Now().Before(deadline) && totalPackets < maxPackets {
		packet, err := packetSource.NextPacket()
		if err != nil {
			continue
		}
		udpLayer := packet.Layer(layers.LayerTypeUDP)
		ipv4Layer := packet.Layer(layers.LayerTypeIPv4)
		if udpLayer == nil || ipv4Layer == nil {
			continue
		}

		udp := udpLayer.(*layers.UDP)
		ip := ipv4Layer.(*layers.IPv4)
		payloadLen := len(udp.Payload)
		totalPackets++
		totalBytes += payloadLen

		srcIP := ip.SrcIP.String()
		srcPort := uint16(udp.SrcPort)
		dstPort := uint16(udp.DstPort)

		if s.localIPs[srcIP] {
			outbound++
		} else {
			inbound++
		}
		topPorts[srcPort]++
		topPorts[dstPort]++

		if likelyAlbionPorts[srcPort] || likelyAlbionPorts[dstPort] {
			albionPackets++
			albionBytes += payloadLen
			if srcPort == 5056 || dstPort == 5056 {
				s.feedPhoton(udp.Payload)
				s.handleGuildBankRawPayload(udp.Payload)
			}
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	obs := make([]api.Observation, 0, 2)
	if totalPackets > 0 {
		obs = append(obs, api.Observation{
			Type:         "net_udp_packets",
			ObservedAt:   now,
			ValueNumeric: float64(totalPackets),
			Payload: map[string]any{
				"bytes_total": totalBytes,
				"inbound":     inbound,
				"outbound":    outbound,
				"top_ports":   summarizeTopPorts(topPorts, 8),
			},
		})
	}
	if albionPackets > 0 {
		obs = append(obs, api.Observation{
			Type:         "net_udp_albion",
			ObservedAt:   now,
			ValueNumeric: float64(albionPackets),
			Payload: map[string]any{
				"bytes_total": albionBytes,
				"hint":        "passive capture by UDP/port heuristic",
			},
		})
	}

	s.mu.Lock()
	if len(s.combatObs) > 0 {
		combat := make([]api.Observation, len(s.combatObs))
		copy(combat, s.combatObs)
		obs = append(obs, combat...)
	}
	s.mu.Unlock()

	return obs, nil
}

func (s *PassiveSniffer) checkNpcapLocked() {
	s.npCapChecked = true
	ensureNpcapDllPath()
	_, err := pcap.FindAllDevs()
	if err != nil {
		s.npCapReady = false
		s.npCapErr = fmt.Errorf("Npcap/WinPcap indisponível (%s): %w", strings.Join(npcapDllCandidates(), ", "), err)
		return
	}
	s.npCapReady = true
	s.npCapErr = nil
}

func pickCaptureDevice(devs []pcap.Interface) *pcap.Interface {
	for i := range devs {
		d := devs[i]
		name := strings.ToLower(d.Name)
		if strings.Contains(name, "loopback") {
			continue
		}
		if len(d.Addresses) == 0 {
			continue
		}
		return &devs[i]
	}
	if len(devs) > 0 {
		return &devs[0]
	}
	return nil
}

func collectLocalIPs() map[string]bool {
	out := map[string]bool{
		"127.0.0.1": true,
	}
	ifaces, err := net.Interfaces()
	if err != nil {
		return out
	}
	for _, iface := range ifaces {
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ip, _, err := net.ParseCIDR(addr.String())
			if err == nil && ip != nil {
				out[ip.String()] = true
			}
		}
	}
	return out
}

func summarizeTopPorts(ports map[uint16]int, limit int) []map[string]any {
	type portCount struct {
		port  uint16
		count int
	}
	pairs := make([]portCount, 0, len(ports))
	for p, c := range ports {
		pairs = append(pairs, portCount{port: p, count: c})
	}
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].count > pairs[j].count
	})
	if limit > len(pairs) {
		limit = len(pairs)
	}
	result := make([]map[string]any, 0, limit)
	for i := 0; i < limit; i++ {
		result = append(result, map[string]any{
			"port":  pairs[i].port,
			"count": pairs[i].count,
		})
	}
	return result
}

func npcapDllCandidates() []string {
	win := os.Getenv("WINDIR")
	if win == "" {
		win = `C:\Windows`
	}
	return []string{
		fmt.Sprintf(`%s\System32\Npcap\wpcap.dll`, win),
		fmt.Sprintf(`%s\SysWOW64\Npcap\wpcap.dll`, win),
	}
}

func ensureNpcapDllPath() {
	path := os.Getenv("PATH")
	for _, dllPath := range npcapDllCandidates() {
		if _, err := os.Stat(dllPath); err == nil {
			dir := strings.TrimSuffix(dllPath, `\wpcap.dll`)
			if !strings.Contains(strings.ToLower(path), strings.ToLower(dir)) {
				_ = os.Setenv("PATH", dir+";"+path)
			}
			return
		}
	}
}
