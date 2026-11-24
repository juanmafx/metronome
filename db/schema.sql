-- Optional SQLite persistence schema for practice sessions.
-- The running backend stores sessions in memory and does not load this file.
CREATE TABLE IF NOT EXISTS practice_sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  bpm              INTEGER NOT NULL CHECK (bpm BETWEEN 30 AND 300),
  beats_per_bar    INTEGER NOT NULL CHECK (beats_per_bar BETWEEN 1 AND 12),
  subdivision      TEXT    NOT NULL DEFAULT 'quarter'
                   CHECK (subdivision IN ('quarter', 'eighth', 'triplet', 'sixteenth')),
  sound            TEXT    NOT NULL CHECK (sound IN ('Click', 'Wood', 'Beep', 'Cowbell')),
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes BETWEEN 0 AND 300),
  notes            TEXT    NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
                   CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z')
) STRICT;

CREATE INDEX IF NOT EXISTS idx_practice_sessions_created_at
  ON practice_sessions (created_at DESC, id DESC);
