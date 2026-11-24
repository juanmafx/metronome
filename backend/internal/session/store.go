package session

import (
	"errors"
	"slices"
	"sync"
	"time"
)

var ErrStoreFull = errors.New("session storage limit reached")

type Store struct {
	mu       sync.RWMutex
	sessions []Session
	nextID   int
	capacity int
	now      func() time.Time
}

func NewStore(capacity int, now func() time.Time) *Store {
	return &Store{nextID: 1, capacity: capacity, now: now}
}

func (s *Store) List() []Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	newestFirst := slices.Clone(s.sessions)
	slices.Reverse(newestFirst)
	return newestFirst
}

func (s *Store) Create(draft Draft) (Session, error) {
	normalized, err := draft.Normalize()
	if err != nil {
		return Session{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.sessions) >= s.capacity {
		return Session{}, ErrStoreFull
	}
	created := Session{
		ID:              s.nextID,
		BPM:             normalized.BPM,
		BeatsPerBar:     normalized.BeatsPerBar,
		Subdivision:     normalized.Subdivision,
		Sound:           normalized.Sound,
		DurationMinutes: normalized.DurationMinutes,
		Notes:           normalized.Notes,
		CreatedAt:       s.now().UTC().Format(time.RFC3339),
	}
	s.nextID++
	s.sessions = append(s.sessions, created)
	return created, nil
}
