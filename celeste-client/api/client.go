package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/venum-i/celeste/config"
)

type Client struct {
	base  string
	token string
	http  *http.Client
}

func New() *Client {
	return &Client{
		base:  config.APIBase,
		token: config.AgentToken,
		http:  &http.Client{Timeout: 120 * time.Second},
	}
}

func (c *Client) url(action string) string {
	return fmt.Sprintf("%s/api/celeste?action=%s", c.base, action)
}

func (c *Client) do(method, action string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.url(action), reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	res, err := c.http.Do(req)
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

	res, err := c.http.Do(req)
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

func (c *Client) Catalog() (*CatalogResponse, error) {
	var out CatalogResponse
	if err := c.do(http.MethodPost, "catalog", map[string]string{"action": "catalog"}, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) UploadPrices(rows []map[string]any) (int, error) {
	var out struct {
		OK   bool `json:"ok"`
		Rows int  `json:"rows"`
	}
	if err := c.do(http.MethodPost, "prices", map[string]any{"rows": rows}, &out); err != nil {
		return 0, err
	}
	return out.Rows, nil
}

func (c *Client) SyncGuild() error {
	return c.do(http.MethodPost, "guild", map[string]string{"action": "guild"}, nil)
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

func (c *Client) SendTelemetry(payload TelemetryPayload) (int, error) {
	var out struct {
		OK       bool `json:"ok"`
		Inserted int  `json:"inserted"`
	}
	if err := c.do(http.MethodPost, "telemetry", payload, &out); err != nil {
		return 0, err
	}
	return out.Inserted, nil
}
