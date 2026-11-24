package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/juanmafx/metronome/backend/internal/graphql"
	"github.com/juanmafx/metronome/backend/internal/session"
)

const (
	trustedOrigin = "http://localhost:5173"
	listQuery     = `{"query":"{ sessions { id } }"}`
)

func newServer(t *testing.T, rateLimit int) *httptest.Server {
	t.Helper()
	store := session.NewStore(100, time.Now)
	server := httptest.NewServer(NewHandler(graphql.NewExecutor(store), Options{
		AllowedOrigins:     []string{trustedOrigin},
		RateLimitPerMinute: rateLimit,
		Now:                time.Now,
	}))
	t.Cleanup(server.Close)
	return server
}

func send(t *testing.T, server *httptest.Server, method, contentType, origin, body string) *http.Response {
	t.Helper()
	request, err := http.NewRequest(method, server.URL+"/graphql", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	if origin != "" {
		request.Header.Set("Origin", origin)
	}
	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = response.Body.Close() })
	return response
}

func TestPostReturnsDataAndSecurityHeaders(t *testing.T) {
	response := send(t, newServer(t, 100), http.MethodPost, "application/json; charset=utf-8", trustedOrigin, listQuery)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status %d", response.StatusCode)
	}
	expected := map[string]string{
		"X-Content-Type-Options":      "nosniff",
		"Cache-Control":               "no-store",
		"Referrer-Policy":             "no-referrer",
		"Access-Control-Allow-Origin": trustedOrigin,
		"Vary":                        "Origin",
	}
	for name, value := range expected {
		if got := response.Header.Get(name); got != value {
			t.Fatalf("%s = %q", name, got)
		}
	}
	if !strings.Contains(response.Header.Get("Content-Security-Policy"), "default-src 'none'") {
		t.Fatal("missing content security policy")
	}
}

func TestRejectsUntrustedOrigin(t *testing.T) {
	server := newServer(t, 100)
	for _, method := range []string{http.MethodPost, http.MethodOptions} {
		response := send(t, server, method, "application/json", "https://evil.example.test", listQuery)
		if response.StatusCode != http.StatusForbidden || response.Header.Get("Access-Control-Allow-Origin") != "" {
			t.Fatalf("%s: status %d", method, response.StatusCode)
		}
	}
}

func TestPreflightAllowsTrustedOrigin(t *testing.T) {
	response := send(t, newServer(t, 100), http.MethodOptions, "", trustedOrigin, "")
	if response.StatusCode != http.StatusNoContent || response.Header.Get("Access-Control-Allow-Origin") != trustedOrigin {
		t.Fatalf("status %d", response.StatusCode)
	}
}

func TestRejectsCrossSiteFormContentTypes(t *testing.T) {
	server := newServer(t, 100)
	for _, contentType := range []string{"", "text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"} {
		if response := send(t, server, http.MethodPost, contentType, "", listQuery); response.StatusCode != http.StatusUnsupportedMediaType {
			t.Fatalf("%q: status %d", contentType, response.StatusCode)
		}
	}
}

func TestRejectsWrongMethod(t *testing.T) {
	response := send(t, newServer(t, 100), http.MethodGet, "", "", "")
	if response.StatusCode != http.StatusMethodNotAllowed || response.Header.Get("Allow") == "" {
		t.Fatalf("status %d", response.StatusCode)
	}
}

func TestRejectsInvalidBodies(t *testing.T) {
	server := newServer(t, 100)
	for _, body := range []string{"", "not json", listQuery + listQuery} {
		if response := send(t, server, http.MethodPost, "application/json", "", body); response.StatusCode != http.StatusBadRequest {
			t.Fatalf("%q: status %d", body, response.StatusCode)
		}
	}
}

func TestRejectsOversizedBody(t *testing.T) {
	body := `{"query":"` + strings.Repeat("a", maxBodyBytes+1) + `"}`
	response := send(t, newServer(t, 100), http.MethodPost, "application/json", "", body)
	if response.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("status %d", response.StatusCode)
	}
}

func TestInvalidQueryReturnsBadRequest(t *testing.T) {
	response := send(t, newServer(t, 100), http.MethodPost, "application/json", "", `{"query":"{ nope }"}`)
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("status %d", response.StatusCode)
	}
	var payload graphql.Response
	raw, _ := io.ReadAll(response.Body)
	if err := json.Unmarshal(raw, &payload); err != nil || len(payload.Errors) == 0 {
		t.Fatalf("unexpected body %s", raw)
	}
}

func TestRateLimitReturns429(t *testing.T) {
	server := newServer(t, 2)
	for range 2 {
		send(t, server, http.MethodPost, "application/json", "", listQuery)
	}
	response := send(t, server, http.MethodPost, "application/json", "", listQuery)
	if response.StatusCode != http.StatusTooManyRequests || response.Header.Get("Retry-After") == "" {
		t.Fatalf("status %d", response.StatusCode)
	}
}

func TestForwardedHeaderDoesNotBypassRateLimit(t *testing.T) {
	server := newServer(t, 1)
	send(t, server, http.MethodPost, "application/json", "", listQuery)
	request, _ := http.NewRequest(http.MethodPost, server.URL+"/graphql", strings.NewReader(listQuery))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Forwarded-For", "203.0.113.9")
	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status %d", response.StatusCode)
	}
}

func TestHealthEndpoint(t *testing.T) {
	server := newServer(t, 1)
	response, err := server.Client().Get(server.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("status %d", response.StatusCode)
	}
}

func TestRateLimiterWindowResets(t *testing.T) {
	now := time.Unix(0, 0)
	limiter := newRateLimiter(1, time.Minute, func() time.Time { return now })
	if !limiter.allow("a") || limiter.allow("a") {
		t.Fatal("limit not applied")
	}
	if !limiter.allow("b") {
		t.Fatal("clients must be isolated")
	}
	now = now.Add(time.Minute)
	if !limiter.allow("a") {
		t.Fatal("window did not reset")
	}
}

func TestRateLimiterBoundsTrackedClients(t *testing.T) {
	now := time.Unix(0, 0)
	limiter := newRateLimiter(1, time.Minute, func() time.Time { return now })
	for i := range maxTrackedClients {
		limiter.clients[string(rune(i+0x10000))] = clientWindow{count: 1, resetAt: now.Add(time.Minute)}
	}
	if limiter.allow("new") {
		t.Fatal("tracked clients exceeded bound")
	}
	now = now.Add(time.Minute)
	if !limiter.allow("new") || len(limiter.clients) != 1 {
		t.Fatalf("expired clients not evicted: %d", len(limiter.clients))
	}
}

func TestConcurrentRequests(t *testing.T) {
	server := newServer(t, 1000)
	body := `{"query":"mutation { createSession(bpm: 90, beatsPerBar: 4, sound: \"Click\") { id } }"}`
	var wg sync.WaitGroup
	for range 50 {
		wg.Go(func() {
			request, _ := http.NewRequest(http.MethodPost, server.URL+"/graphql", strings.NewReader(body))
			request.Header.Set("Content-Type", "application/json")
			response, err := server.Client().Do(request)
			if err != nil {
				t.Error(err)
				return
			}
			defer response.Body.Close()
			if response.StatusCode != http.StatusOK {
				t.Errorf("status %d", response.StatusCode)
			}
		})
	}
	wg.Wait()
}
