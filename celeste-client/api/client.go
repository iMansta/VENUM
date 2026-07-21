package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/venum-i/anaconda/config"
)

type Client struct {
	base  string
	token string
	http  *http.Client
}

// newResilientHTTPClient cria um http.Client que prefere IPv4 para evitar
// falhas intermitentes de resolução (AAAA) em redes/Windows com IPv6 quebrado,
// que aparecem como "no such host". Também reduz reuso agressivo de conexões
// que podem disparar WSAEACCES por firewall/antivírus.
func newResilientHTTPClient() *http.Client {
	baseDialer := &net.Dialer{
		Timeout:   15 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// Força IPv4; se falhar, tenta a resolução padrão como fallback.
			if conn, err := baseDialer.DialContext(ctx, "tcp4", addr); err == nil {
				return conn, nil
			}
			return baseDialer.DialContext(ctx, network, addr)
		},
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          10,
		IdleConnTimeout:       60 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: 2 * time.Second,
	}
	return &http.Client{
		Timeout:   120 * time.Second,
		Transport: transport,
	}
}

func New() *Client {
	return &Client{
		base:  config.APIBase,
		token: config.AgentToken,
		http:  newResilientHTTPClient(),
	}
}

// SharedHTTPClient expõe o cliente HTTP resiliente (IPv4 + timeouts) para
// chamadas externas como a Albion Data API.
func SharedHTTPClient() *http.Client {
	return newResilientHTTPClient()
}

// GetJSONWithRetry faz GET com cliente resiliente e tentativas em falhas de rede.
func GetJSONWithRetry(url string, out any) error {
	client := newResilientHTTPClient()
	const attempts = 3
	var lastErr error
	for i := 0; i < attempts; i++ {
		if i > 0 {
			time.Sleep(time.Duration(i) * 1500 * time.Millisecond)
		}
		req, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			return err
		}
		res, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		raw, readErr := io.ReadAll(res.Body)
		res.Body.Close()
		if readErr != nil {
			lastErr = readErr
			continue
		}
		if res.StatusCode >= 400 {
			lastErr = fmt.Errorf("HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(raw)))
			continue
		}
		if out != nil {
			if err := json.Unmarshal(raw, out); err != nil {
				return err
			}
		}
		return nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("falha ao consultar URL")
	}
	return lastErr
}

// doRequestWithRetry executa uma requisição com tentativas em erros transitórios
// de rede (DNS/conexão). Não repete em erros HTTP de aplicação (>=400).
func (c *Client) doRequestWithRetry(req *http.Request, bodyBytes []byte) (*http.Response, error) {
	const attempts = 3
	var lastErr error
	for i := 0; i < attempts; i++ {
		if i > 0 {
			time.Sleep(time.Duration(i) * 1500 * time.Millisecond)
			if bodyBytes != nil {
				req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			}
		}
		res, err := c.http.Do(req)
		if err == nil {
			return res, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func (c *Client) url(action string) string {
	return fmt.Sprintf("%s/api/celeste?action=%s", c.base, action)
}

func (c *Client) do(method, action string, body any, out any) error {
	var reader io.Reader
	var bodyBytes []byte
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyBytes = b
		reader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.url(action), reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.doRequestWithRetry(req, bodyBytes)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d: %s", res.StatusCode, string(raw))
	}
	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) Ping() error {
	req, err := http.NewRequest(http.MethodGet, c.url("ping"), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	res, err := c.doRequestWithRetry(req, nil)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d: %s", res.StatusCode, string(raw))
	}
	return nil
}

type CatalogResponse struct {
	OK        bool     `json:"ok"`
	ItemIDs   []string `json:"itemIds"`
	Locations []string `json:"locations"`
	BatchSize int      `json:"batchSize"`
}

type ActivePveMission struct {
	ID               string `json:"id"`
	Title            string `json:"title"`
	TargetItem       string `json:"targetItem"`
	MinFameThreshold int    `json:"minFameThreshold"`
	EndDate          string `json:"endDate"`
}

type GuildSyncResponse struct {
	OK                bool               `json:"ok"`
	MemberCount       int                `json:"memberCount"`
	MatchedProfiles   int                `json:"matchedProfiles"`
	Activated         int                `json:"activated"`
	Deactivated       int                `json:"deactivated"`
	FameSynced        int                `json:"fameSynced"`
	MissionUpdates    int                `json:"missionUpdates"`
	ActivePveMissions []ActivePveMission `json:"activePveMissions"`
	PlayerPveMissions []ActivePveMission `json:"playerPveMissions"`
}

func (c *Client) Catalog() (*CatalogResponse, error) {
	var out CatalogResponse
	if err := c.do(http.MethodPost, "catalog", map[string]string{"action": "catalog"}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UploadPrices(rows []map[string]any) (int, error) {
	var out struct {
		OK    bool   `json:"ok"`
		Rows  int    `json:"rows"`
		Error string `json:"error"`
	}
	if err := c.do(http.MethodPost, "prices", map[string]any{"rows": rows}, &out); err != nil {
		return 0, err
	}
	if out.Rows == 0 && out.Error != "" {
		return 0, fmt.Errorf("%s", out.Error)
	}
	return out.Rows, nil
}

// SyncPricesViaHub pede ao servidor que busque preços na Albion Data API e
// persista no cache — fallback quando o cliente local não consegue alcançar a API.
func (c *Client) SyncPricesViaHub() (int, error) {
	var out struct {
		OK    bool   `json:"ok"`
		Rows  int    `json:"rows"`
		Error string `json:"error"`
	}
	if err := c.do(http.MethodPost, "prices-sync", map[string]string{"action": "prices-sync"}, &out); err != nil {
		return 0, err
	}
	if out.Rows == 0 && out.Error != "" {
		return 0, fmt.Errorf("%s", out.Error)
	}
	return out.Rows, nil
}

func (c *Client) SyncGuild(clientID, username string) (*GuildSyncResponse, error) {
	var out GuildSyncResponse
	body := map[string]string{
		"action":   "guild",
		"clientId": clientID,
		"username": username,
	}
	if err := c.do(http.MethodPost, "guild", body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) SyncEvents() error {
	return c.do(http.MethodPost, "events", map[string]string{"action": "events"}, nil)
}

func (c *Client) SyncMissions() error {
	return c.do(http.MethodPost, "missions", map[string]string{"action": "missions"}, nil)
}

type Observation struct {
	Type         string         `json:"type"`
	ObservedAt   string         `json:"observedAt,omitempty"`
	ValueNumeric float64        `json:"valueNumeric,omitempty"`
	Payload      map[string]any `json:"payload,omitempty"`
	Raw          string         `json:"raw,omitempty"`
}

type TelemetryPayload struct {
	ClientID     string        `json:"clientId"`
	Observations []Observation `json:"observations"`
	Meta         map[string]any `json:"meta,omitempty"`
}

type TelemetryResponse struct {
	OK        bool     `json:"ok"`
	Inserted  int      `json:"inserted"`
	Warnings  []Warning `json:"warnings"`
}

type Warning struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type PairingRedeemResponse struct {
	OK                  bool   `json:"ok"`
	ProfileID           string `json:"profileId"`
	Username            string `json:"username"`
	AlbionCharacterName string `json:"albionCharacterName"`
	Error               string `json:"error"`
}

func (c *Client) SendTelemetry(payload TelemetryPayload) (*TelemetryResponse, error) {
	var out TelemetryResponse
	if err := c.do(http.MethodPost, "telemetry", payload, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

type GuildBankPayload struct {
	ClientID            string         `json:"clientId"`
	GuildID             string         `json:"guildId,omitempty"`
	SilverBalance       int64          `json:"silverBalance"`
	ProfileID           string         `json:"profileId,omitempty"`
	DedupeWindowSeconds int            `json:"dedupeWindowSeconds,omitempty"`
	Meta                map[string]any `json:"meta,omitempty"`
}

type GuildBankResponse struct {
	OK                    bool   `json:"ok"`
	Inserted              bool   `json:"inserted"`
	HistoryID             string `json:"historyId"`
	SkippedReason         string `json:"skippedReason"`
	SilverBalance         any    `json:"silverBalance"`
	GuildID               string `json:"guildId"`
	CollectedByProfileID  string `json:"collectedByProfileId"`
	ProfileSource         string `json:"profileSource"`
	Error                 string `json:"error"`
	Code                  string `json:"code"`
}

func (c *Client) SubmitGuildBankBalance(payload GuildBankPayload) (*GuildBankResponse, error) {
	var out GuildBankResponse
	if err := c.do(http.MethodPost, "guild-bank", payload, &out); err != nil {
		return nil, err
	}
	if !out.OK {
		if out.Error != "" {
			return &out, fmt.Errorf("%s", out.Error)
		}
		return &out, fmt.Errorf("hub recusou saldo do banco da guilda")
	}
	return &out, nil
}

// SendGuildBankBalance envia saldo para a API Celeste (wrapper standalone).
func SendGuildBankBalance(apiURL, agentToken string, payload GuildBankPayload) error {
	client := &Client{
		base:  strings.TrimRight(apiURL, "/"),
		token: agentToken,
		http:  newResilientHTTPClient(),
	}
	_, err := client.SubmitGuildBankBalance(payload)
	return err
}

func (c *Client) RedeemPairingToken(clientID, token string) (*PairingRedeemResponse, error) {
	var out PairingRedeemResponse
	body := map[string]string{
		"clientId": clientID,
		"token":    token,
	}
	if err := c.do(http.MethodPost, "pair-redeem", body, &out); err != nil {
		return nil, err
	}
	if !out.OK {
		if out.Error != "" {
			return nil, fmt.Errorf("%s", out.Error)
		}
		return nil, fmt.Errorf("pareamento recusado")
	}
	return &out, nil
}

func (c *Client) SubmitGuildAdminMetrics(body any, pairingToken string, out any) error {
	var bodyBytes []byte
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyBytes = b
	}

	req, err := http.NewRequest(http.MethodPost, c.url("guild-admin-metrics"), bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Admin-Pairing-Token", strings.TrimSpace(pairingToken))

	res, err := c.doRequestWithRetry(req, bodyBytes)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d: %s", res.StatusCode, string(raw))
	}
	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			return err
		}
	}
	return nil
}
