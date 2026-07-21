package collector

import (
	"sync/atomic"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/venum-i/anaconda/logger"
)

var continuousSnifferRunning atomic.Bool

// StartNetworkSniffer inicia captura passiva contínua na porta UDP 5056 (Photon Albion).
// deviceName vazio seleciona a interface automaticamente (pickCaptureDevice).
// Reutiliza o photon.Parser já ligado ao PassiveSniffer.
func StartNetworkSniffer(s *PassiveSniffer, deviceName string, stop <-chan struct{}) {
	if s == nil {
		return
	}
	if !continuousSnifferRunning.CompareAndSwap(false, true) {
		return
	}

	go func() {
		defer continuousSnifferRunning.Store(false)

		ready, err := s.Status()
		if !ready {
			logger.Warn("[Network] Sniffer contínuo indisponível: %v", err)
			return
		}

		devices, err := pcap.FindAllDevs()
		if err != nil {
			logger.Warn("[Network] Falha ao listar interfaces: %v", err)
			return
		}

		var dev *pcap.Interface
		if deviceName != "" {
			for i := range devices {
				if devices[i].Name == deviceName {
					dev = &devices[i]
					break
				}
			}
		}
		if dev == nil {
			dev = pickCaptureDevice(devices)
		}
		if dev == nil {
			logger.Warn("[Network] Nenhuma interface válida para sniffer contínuo")
			return
		}

		handle, err := pcap.OpenLive(dev.Name, 1600, true, 500*time.Millisecond)
		if err != nil {
			logger.Warn("[Network] Erro ao abrir interface %s: %v", dev.Name, err)
			return
		}
		defer handle.Close()

		if err := handle.SetBPFFilter("udp port 5056"); err != nil {
			logger.Warn("[Network] Erro ao setar BPF filter: %v", err)
			return
		}

		logger.Info("[Network] Sniffer contínuo UDP 5056 em %s", dev.Name)

		packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
		packetSource.NoCopy = true

		for {
			select {
			case <-stop:
				logger.Info("[Network] Sniffer contínuo encerrado")
				return
			default:
			}

			packet, err := packetSource.NextPacket()
			if err != nil {
				continue
			}

			udpLayer := packet.Layer(layers.LayerTypeUDP)
			if udpLayer == nil {
				continue
			}
			udp := udpLayer.(*layers.UDP)
			payload := udp.Payload
			if len(payload) == 0 {
				continue
			}

			s.feedPhoton(payload)
			s.handleGuildBankRawPayload(payload)
		}
	}()
}
