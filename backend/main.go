package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Session struct {
	ID              int    `json:"id"`
	BPM             int    `json:"bpm"`
	BeatsPerBar     int    `json:"beatsPerBar"`
	Subdivision     string `json:"subdivision"`
	Sound           string `json:"sound"`
	DurationMinutes int    `json:"durationMinutes"`
	Notes           string `json:"notes"`
	CreatedAt       string `json:"createdAt"`
}

var sessions = []Session{
	{
		ID:              1,
		BPM:             90,
		BeatsPerBar:     4,
		Subdivision:     "quarter",
		Sound:           "Click",
		DurationMinutes: 15,
		Notes:           "Warmup with accent on beat 1.",
		CreatedAt:       "2026-03-22T00:00:00Z",
	},
}

type GraphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables"`
}

func graphqlHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": "method not allowed"})
		return
	}

	var req GraphQLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": "invalid json"})
		return
	}

	if strings.Contains(req.Query, "sessions") {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"data": map[string]interface{}{
				"sessions": sessions,
			},
		})
		return
	}

	if strings.Contains(req.Query, "createSession") {
		if req.Variables == nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": "missing variables"})
			return
		}

		bpm, err := intVar(req.Variables, "bpm")
		if err != nil || bpm < 30 || bpm > 300 {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": "bpm must be between 30 and 300"})
			return
		}

		beatsPerBar, err := intVar(req.Variables, "beatsPerBar")
		if err != nil || beatsPerBar < 1 || beatsPerBar > 12 {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": "beatsPerBar must be between 1 and 12"})
			return
		}

		subdivision := stringVar(req.Variables, "subdivision")
		if subdivision == "" {
			subdivision = "quarter"
		}

		sound := stringVar(req.Variables, "sound")
		if sound == "" {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": "sound is required"})
			return
		}

		notes := stringVar(req.Variables, "notes")

		durationMinutes, err := optionalIntVar(req.Variables, "durationMinutes")
		if err != nil || durationMinutes < 0 || durationMinutes > 300 {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": "durationMinutes must be between 0 and 300"})
			return
		}

		newSession := Session{
			ID:              len(sessions) + 1,
			BPM:             bpm,
			BeatsPerBar:     beatsPerBar,
			Subdivision:     subdivision,
			Sound:           sound,
			DurationMinutes: durationMinutes,
			Notes:           notes,
			CreatedAt:       time.Now().UTC().Format(time.RFC3339),
		}

		sessions = append(sessions, newSession)

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"data": map[string]interface{}{
				"createSession": newSession,
			},
		})
		return
	}

	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"error": "unsupported query"})
}

func stringVar(vars map[string]interface{}, key string) string {
	value, ok := vars[key].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(value)
}

func intVar(vars map[string]interface{}, key string) (int, error) {
	raw, exists := vars[key]
	if !exists {
		return 0, strconv.ErrSyntax
	}

	switch value := raw.(type) {
	case float64:
		return int(value), nil
	case int:
		return value, nil
	case string:
		return strconv.Atoi(value)
	default:
		return 0, strconv.ErrSyntax
	}
}

func optionalIntVar(vars map[string]interface{}, key string) (int, error) {
	_, exists := vars[key]
	if !exists {
		return 0, nil
	}
	return intVar(vars, key)
}

func main() {
	http.HandleFunc("/graphql", graphqlHandler)
	log.Println("backend listening on http://localhost:8080/graphql")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
