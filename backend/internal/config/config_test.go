package config

import "testing"

func envOf(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestLoadDefaultsToLoopback(t *testing.T) {
	cfg, err := Load(envOf(nil))
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.IsLoopback() || cfg.RateLimitPerMinute != defaultRateLimit || cfg.MaxSessions != defaultMaxSessions {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
}

func TestLoadReadsOverrides(t *testing.T) {
	cfg, err := Load(envOf(map[string]string{
		"METRONOME_ADDR":                  "0.0.0.0:9000",
		"METRONOME_ALLOWED_ORIGINS":       "https://app.example.test",
		"METRONOME_RATE_LIMIT_PER_MINUTE": "5",
		"METRONOME_MAX_SESSIONS":          "7",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.IsLoopback() || cfg.AllowedOrigins[0] != "https://app.example.test" || cfg.RateLimitPerMinute != 5 || cfg.MaxSessions != 7 {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	cases := map[string]map[string]string{
		"address":          {"METRONOME_ADDR": "nonsense"},
		"wildcard origin":  {"METRONOME_ALLOWED_ORIGINS": "*"},
		"wildcard host":    {"METRONOME_ALLOWED_ORIGINS": "https://*.a.test"},
		"uppercase host":   {"METRONOME_ALLOWED_ORIGINS": "https://A.test"},
		"uppercase scheme": {"METRONOME_ALLOWED_ORIGINS": "HTTPS://a.test"},
		"origin path":      {"METRONOME_ALLOWED_ORIGINS": "https://a.test/path"},
		"origin scheme":    {"METRONOME_ALLOWED_ORIGINS": "ftp://a.test"},
		"rate limit":       {"METRONOME_RATE_LIMIT_PER_MINUTE": "0"},
		"max sessions":     {"METRONOME_MAX_SESSIONS": "-1"},
	}
	for name, env := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Load(envOf(env)); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
