package session

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

func validDraft() Draft {
	return Draft{BPM: 120, BeatsPerBar: 4, Subdivision: "eighth", Sound: "Wood", DurationMinutes: 10, Notes: "  steady  "}
}

func fixedClock() time.Time {
	return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
}

func TestNormalizeAcceptsBoundaries(t *testing.T) {
	for _, bpm := range []int{MinBPM, MaxBPM} {
		draft := validDraft()
		draft.BPM = bpm
		if _, err := draft.Normalize(); err != nil {
			t.Fatalf("bpm %d: %v", bpm, err)
		}
	}
}

func TestNormalizeAppliesDefaultsAndTrims(t *testing.T) {
	draft := validDraft()
	draft.Subdivision = " "
	got, err := draft.Normalize()
	if err != nil {
		t.Fatal(err)
	}
	if got.Subdivision != DefaultSubdivision || got.Notes != "steady" {
		t.Fatalf("unexpected normalization: %+v", got)
	}
}

func TestNormalizeRejectsInvalidFields(t *testing.T) {
	cases := map[string]struct {
		field  string
		mutate func(*Draft)
	}{
		"bpm low":        {"bpm", func(d *Draft) { d.BPM = MinBPM - 1 }},
		"bpm high":       {"bpm", func(d *Draft) { d.BPM = MaxBPM + 1 }},
		"beats low":      {"beatsPerBar", func(d *Draft) { d.BeatsPerBar = 0 }},
		"beats high":     {"beatsPerBar", func(d *Draft) { d.BeatsPerBar = 13 }},
		"minutes low":    {"durationMinutes", func(d *Draft) { d.DurationMinutes = -1 }},
		"minutes high":   {"durationMinutes", func(d *Draft) { d.DurationMinutes = 301 }},
		"subdivision":    {"subdivision", func(d *Draft) { d.Subdivision = "<b>" }},
		"sound missing":  {"sound", func(d *Draft) { d.Sound = "" }},
		"sound unknown":  {"sound", func(d *Draft) { d.Sound = "Laser" }},
		"notes too long": {"notes", func(d *Draft) { d.Notes = strings.Repeat("a", MaxNotesLength+1) }},
		"notes control":  {"notes", func(d *Draft) { d.Notes = "bad\x00value" }},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			draft := validDraft()
			tc.mutate(&draft)
			_, err := draft.Normalize()
			var validationErr *ValidationError
			if !errors.As(err, &validationErr) || validationErr.Field != tc.field {
				t.Fatalf("want validation error on %s, got %v", tc.field, err)
			}
		})
	}
}

func TestNotesLimitCountsCharactersNotBytes(t *testing.T) {
	draft := validDraft()
	draft.Notes = strings.Repeat("é", MaxNotesLength)
	if _, err := draft.Normalize(); err != nil {
		t.Fatal(err)
	}
}

func TestStoreListsNewestFirstAndAssignsIDs(t *testing.T) {
	store := NewStore(10, fixedClock)
	first, _ := store.Create(validDraft())
	second, _ := store.Create(validDraft())
	listed := store.List()
	if len(listed) != 2 || listed[0].ID != second.ID || listed[1].ID != first.ID {
		t.Fatalf("unexpected order: %+v", listed)
	}
	if first.CreatedAt != "2026-01-02T03:04:05Z" {
		t.Fatalf("unexpected timestamp %s", first.CreatedAt)
	}
}

func TestStoreListReturnsDefensiveCopy(t *testing.T) {
	store := NewStore(10, fixedClock)
	_, _ = store.Create(validDraft())
	store.List()[0].Notes = "tampered"
	if store.List()[0].Notes == "tampered" {
		t.Fatal("list exposed internal state")
	}
}

func TestStoreEnforcesCapacity(t *testing.T) {
	store := NewStore(1, fixedClock)
	_, _ = store.Create(validDraft())
	if _, err := store.Create(validDraft()); !errors.Is(err, ErrStoreFull) {
		t.Fatalf("want ErrStoreFull, got %v", err)
	}
}

func TestStoreConcurrentCreatesHaveUniqueIDs(t *testing.T) {
	const writers = 100
	store := NewStore(writers, fixedClock)
	var wg sync.WaitGroup
	for range writers {
		wg.Go(func() {
			if _, err := store.Create(validDraft()); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	seen := map[int]bool{}
	for _, item := range store.List() {
		if seen[item.ID] {
			t.Fatalf("duplicate id %d", item.ID)
		}
		seen[item.ID] = true
	}
	if len(seen) != writers {
		t.Fatalf("want %d sessions, got %d", writers, len(seen))
	}
}
