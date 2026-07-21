package adminui

import (
	"context"
	"embed"
	"fmt"
	"html/template"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/venum-i/anaconda/api"
	"github.com/venum-i/anaconda/collector"
	"github.com/venum-i/anaconda/config"
	"github.com/venum-i/anaconda/logger"
)

//go:embed form.html
var formHTML embed.FS

type Server struct {
	client   *api.Client
	clientID string
	token    string
	srv      *http.Server
	mu       sync.Mutex
	running  bool
	baseURL  string
}

const defaultAdminPort = 17341

var adminPortFallbacks = []int{17341, 17342, 17343, 17344}

func New(client *api.Client, clientID, pairingToken string) *Server {
	return &Server{
		client:   client,
		clientID: clientID,
		token:    strings.TrimSpace(strings.ToUpper(pairingToken)),
	}
}

func (s *Server) SetToken(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.token = strings.TrimSpace(strings.ToUpper(token))
}

func (s *Server) Token() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.token
}

func (s *Server) BaseURL() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.baseURL != "" {
		return s.baseURL
	}
	return fmt.Sprintf("http://127.0.0.1:%d/", defaultAdminPort)
}

func (s *Server) EnsureRunning(ctx context.Context) (string, error) {
	s.mu.Lock()
	running := s.running
	url := s.baseURL
	s.mu.Unlock()
	if running && url != "" {
		return url, nil
	}
	return s.Start(ctx)
}

func (s *Server) Start(ctx context.Context) (string, error) {
	s.mu.Lock()
	if s.running {
		url := s.baseURL
		s.mu.Unlock()
		return url, nil
	}
	s.mu.Unlock()

	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleForm)
	mux.HandleFunc("/submit", s.handleSubmit)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	var ln net.Listener
	var listenErr error
	for _, port := range adminPortFallbacks {
		addr := fmt.Sprintf("127.0.0.1:%d", port)
		ln, listenErr = net.Listen("tcp", addr)
		if listenErr == nil {
			break
		}
	}
	if ln == nil {
		return "", fmt.Errorf("não foi possível abrir porta local (%v)", listenErr)
	}

	baseURL := fmt.Sprintf("http://%s/", ln.Addr().String())
	s.srv = &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.srv.Shutdown(shutdownCtx)
		_ = ln.Close()
		s.mu.Lock()
		s.running = false
		s.baseURL = ""
		s.mu.Unlock()
	}()

	go func() {
		if err := s.srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			logger.Error("Painel admin local encerrado: %v", err)
			s.mu.Lock()
			s.running = false
			s.baseURL = ""
			s.mu.Unlock()
		}
	}()

	healthURL := baseURL + "health"
	if err := waitUntilReady(healthURL, 8*time.Second); err != nil {
		_ = s.srv.Close()
		return "", err
	}

	s.mu.Lock()
	s.running = true
	s.baseURL = baseURL
	url := s.baseURL
	s.mu.Unlock()
	logger.Info("Painel admin local escutando em %s", url)
	return url, nil
}

func waitUntilReady(url string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(120 * time.Millisecond)
	}
	return fmt.Errorf("painel local não iniciou a tempo")
}

type formView struct {
	APIBase      string
	Version      string
	ClientID     string
	TokenMasked  string
	Error        string
	Success      string
	SilverAmount string
	SeasonPoints string
	MemberCount  string
	Note         string
	PairingToken string
}

func (s *Server) handleForm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	view := formView{
		APIBase:      config.APIBase,
		Version:      config.Version,
		ClientID:     s.clientID,
		TokenMasked:  maskToken(s.token),
		PairingToken: s.token,
	}
	if msg := strings.TrimSpace(r.URL.Query().Get("error")); msg != "" {
		view.Error = msg
	}
	if msg := strings.TrimSpace(r.URL.Query().Get("success")); msg != "" {
		view.Success = msg
	}

	tpl, err := template.ParseFS(formHTML, "form.html")
	if err != nil {
		http.Error(w, "template error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = tpl.Execute(w, view)
}

func (s *Server) handleSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/?error="+encodeMsg("Formulário inválido"), http.StatusSeeOther)
		return
	}

	token := strings.TrimSpace(strings.ToUpper(r.FormValue("pairingToken")))
	if token == "" {
		token = s.token
	}
	if token == "" {
		http.Redirect(w, r, "/?error="+encodeMsg("Informe o token de pareamento gerado no painel admin"), http.StatusSeeOther)
		return
	}

	silver := parseOptionalInt(r.FormValue("silverAmount"))
	season := parseOptionalInt(r.FormValue("seasonPoints"))
	members := parseOptionalInt(r.FormValue("memberCount"))
	note := strings.TrimSpace(r.FormValue("note"))

	if silver == nil && season == nil && members == nil {
		http.Redirect(w, r, "/?error="+encodeMsg("Preencha ao menos prata, pontos de temporada ou membros"), http.StatusSeeOther)
		return
	}

	_ = collector.SavePairingToken(token)
	s.token = token

	payload := map[string]any{
		"clientId": s.clientID,
		"note":     note,
	}
	if silver != nil {
		payload["silverAmount"] = *silver
	}
	if season != nil {
		payload["seasonPoints"] = *season
	}
	if members != nil {
		payload["memberCount"] = *members
	}

	var out map[string]any
	if err := s.client.SubmitGuildAdminMetrics(payload, token, &out); err != nil {
		logger.Warn("Envio métricas admin: %v", err)
		http.Redirect(w, r, "/?error="+encodeMsg(err.Error()), http.StatusSeeOther)
		return
	}

	msg := "Métricas enviadas com sucesso"
	if submittedBy, ok := out["submittedBy"].(string); ok && submittedBy != "" {
		msg += " por " + submittedBy
	}
	http.Redirect(w, r, "/?success="+encodeMsg(msg), http.StatusSeeOther)
}

func parseOptionalInt(raw string) *int64 {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return nil
	}
	clean = strings.ReplaceAll(clean, ".", "")
	clean = strings.ReplaceAll(clean, ",", "")
	clean = strings.ReplaceAll(clean, " ", "")
	n, err := strconv.ParseInt(clean, 10, 64)
	if err != nil || n < 0 {
		return nil
	}
	return &n
}

func maskToken(token string) string {
	if len(token) <= 4 {
		return token
	}
	return strings.Repeat("•", len(token)-4) + token[len(token)-4:]
}

func encodeMsg(msg string) string {
	return url.QueryEscape(msg)
}
