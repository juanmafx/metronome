package httpapi

import (
	"sync"
	"time"
)

const maxTrackedClients = 10000

type clientWindow struct {
	count   int
	resetAt time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	clients map[string]clientWindow
	now     func() time.Time
}

func newRateLimiter(limit int, window time.Duration, now func() time.Time) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, clients: map[string]clientWindow{}, now: now}
}

func (l *rateLimiter) allow(client string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	current, known := l.clients[client]
	if !known || !now.Before(current.resetAt) {
		if !known && len(l.clients) >= maxTrackedClients {
			l.evictExpired(now)
			if len(l.clients) >= maxTrackedClients {
				return false
			}
		}
		l.clients[client] = clientWindow{count: 1, resetAt: now.Add(l.window)}
		return true
	}
	if current.count >= l.limit {
		return false
	}
	current.count++
	l.clients[client] = current
	return true
}

func (l *rateLimiter) evictExpired(now time.Time) {
	for client, window := range l.clients {
		if !now.Before(window.resetAt) {
			delete(l.clients, client)
		}
	}
}
