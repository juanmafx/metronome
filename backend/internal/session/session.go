package session

import (
	"fmt"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	MinBPM             = 30
	MaxBPM             = 300
	MinBeatsPerBar     = 1
	MaxBeatsPerBar     = 12
	MinDurationMinutes = 0
	MaxDurationMinutes = 300
	MaxNotesLength     = 2000
	DefaultSubdivision = "quarter"
)

var (
	Subdivisions = []string{"quarter", "eighth", "triplet", "sixteenth"}
	Sounds       = []string{"Click", "Wood", "Beep", "Cowbell"}
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

type Draft struct {
	BPM             int
	BeatsPerBar     int
	Subdivision     string
	Sound           string
	DurationMinutes int
	Notes           string
}

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func (d Draft) Normalize() (Draft, error) {
	if d.BPM < MinBPM || d.BPM > MaxBPM {
		return Draft{}, invalid("bpm", "bpm must be between %d and %d", MinBPM, MaxBPM)
	}
	if d.BeatsPerBar < MinBeatsPerBar || d.BeatsPerBar > MaxBeatsPerBar {
		return Draft{}, invalid("beatsPerBar", "beatsPerBar must be between %d and %d", MinBeatsPerBar, MaxBeatsPerBar)
	}
	if d.DurationMinutes < MinDurationMinutes || d.DurationMinutes > MaxDurationMinutes {
		return Draft{}, invalid("durationMinutes", "durationMinutes must be between %d and %d", MinDurationMinutes, MaxDurationMinutes)
	}

	d.Subdivision = strings.TrimSpace(d.Subdivision)
	if d.Subdivision == "" {
		d.Subdivision = DefaultSubdivision
	}
	if !slices.Contains(Subdivisions, d.Subdivision) {
		return Draft{}, invalid("subdivision", "subdivision must be one of %s", strings.Join(Subdivisions, ", "))
	}

	d.Sound = strings.TrimSpace(d.Sound)
	if !slices.Contains(Sounds, d.Sound) {
		return Draft{}, invalid("sound", "sound must be one of %s", strings.Join(Sounds, ", "))
	}

	d.Notes = strings.TrimSpace(strings.ReplaceAll(d.Notes, "\r\n", "\n"))
	if utf8.RuneCountInString(d.Notes) > MaxNotesLength {
		return Draft{}, invalid("notes", "notes must be at most %d characters", MaxNotesLength)
	}
	if strings.ContainsFunc(d.Notes, isForbiddenControl) {
		return Draft{}, invalid("notes", "notes must not contain control characters")
	}
	return d, nil
}

func isForbiddenControl(r rune) bool {
	return unicode.IsControl(r) && r != '\n' && r != '\t'
}

func invalid(field, format string, args ...any) error {
	return &ValidationError{Field: field, Message: fmt.Sprintf(format, args...)}
}
