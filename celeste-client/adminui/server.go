package adminui

import (
	"context"
	"embed"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"strconv"
	"strings"
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
}

func New(client *api.Client, clientID, pairingToken string) *Server {
	return &Server{
		client:   client,
		clientID: clientID,
		token:    strings.TrimSpace(strings.ToUpper(pairingToken)),
	}
}

func (s *Server) Start(ctx context.Context) (string, error) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleForm)
	mux.HandleFunc("/submit", s.handleSubmit)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	s.srv = &http.Server{
		Addr:              "127.0.0.1:17341",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.srv.Shutdown(shutdownCtx)
	}()

	go func() {
		if err := s.srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Warn("Painel admin local: %v", err)
		}
	}()

	if err := waitUntilReady("http://127.0.0.1:17341/health", 2*time.Second); err != nil {
		return "", err
	}
	return "http://127.0.0.1:17341/", nil
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
}

func (s *Server) handleForm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	view := formView{
		APIBase:     config.APIBase,
		Version:     config.Version,
		ClientID:    s.clientID,
		TokenMasked: maskToken(s.token),
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
