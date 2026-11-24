package config

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
)

const (
	defaultAddress        = "127.0.0.1:8080"
	defaultAllowedOrigins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
	defaultRateLimit      = 120
	defaultMaxSessions    = 1000
)

type Config struct {
	Address            string
	AllowedOrigins     []string
	RateLimitPerMinute int
	MaxSessions        int
}

func Load(getenv func(string) string) (Config, error) {
	address := valueOr(getenv("METRONOME_ADDR"), defaultAddress)
	if _, _, err := net.SplitHostPort(address); err != nil {
		return Config{}, fmt.Errorf("METRONOME_ADDR must be host:port: %w", err)
	}
	origins, err := parseOrigins(valueOr(getenv("METRONOME_ALLOWED_ORIGINS"), defaultAllowedOrigins))
	if err != nil {
		return Config{}, err
	}
	rateLimit, err := positiveInt(getenv("METRONOME_RATE_LIMIT_PER_MINUTE"), defaultRateLimit, "METRONOME_RATE_LIMIT_PER_MINUTE")
	if err != nil {
		return Config{}, err
	}
	maxSessions, err := positiveInt(getenv("METRONOME_MAX_SESSIONS"), defaultMaxSessions, "METRONOME_MAX_SESSIONS")
	if err != nil {
		return Config{}, err
	}
	return Config{Address: address, AllowedOrigins: origins, RateLimitPerMinute: rateLimit, MaxSessions: maxSessions}, nil
}

func (c Config) IsLoopback() bool {
	host, _, err := net.SplitHostPort(c.Address)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func parseOrigins(raw string) ([]string, error) {
	var origins []string
	for candidate := range strings.SplitSeq(raw, ",") {
		origin := strings.TrimSpace(candidate)
		parsed, err := url.Parse(origin)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" ||
			parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.User != nil ||
			strings.Contains(origin, "*") || origin != strings.ToLower(origin) {
			return nil, fmt.Errorf("METRONOME_ALLOWED_ORIGINS contains an invalid origin: %q", origin)
		}
		origins = append(origins, origin)
	}
	return origins, nil
}

func positiveInt(raw string, fallback int, name string) (int, error) {
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 0, fmt.Errorf("%s must be a positive integer", name)
	}
	return value, nil
}

func valueOr(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}
