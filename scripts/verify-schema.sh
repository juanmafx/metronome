#!/usr/bin/env bash
# Applies db/schema.sql to an in-memory SQLite database and checks its constraints.
set -euo pipefail

schema="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/db/schema.sql"
valid="(bpm, beats_per_bar, sound) VALUES (120, 4, 'Click')"
failures=0

expect_accept() {
  if sqlite3 -bail :memory: ".read $schema" "$2" >/dev/null 2>&1; then
    echo "PASS accept: $1"
  else
    echo "FAIL accept: $1"
    failures=$((failures + 1))
  fi
}

expect_reject() {
  if sqlite3 -bail :memory: ".read $schema" "$2" >/dev/null 2>&1; then
    echo "FAIL reject: $1"
    failures=$((failures + 1))
  else
    echo "PASS reject: $1"
  fi
}

insert="INSERT INTO practice_sessions"
expect_accept "minimal row with defaults" "$insert $valid;"
expect_accept "schema is idempotent" ".read $schema"
expect_accept "boundary values" "$insert (bpm, beats_per_bar, sound, duration_minutes) VALUES (300, 12, 'Cowbell', 300);"
expect_reject "bpm below range" "$insert (bpm, beats_per_bar, sound) VALUES (29, 4, 'Click');"
expect_reject "bpm above range" "$insert (bpm, beats_per_bar, sound) VALUES (301, 4, 'Click');"
expect_reject "beats below range" "$insert (bpm, beats_per_bar, sound) VALUES (120, 0, 'Click');"
expect_reject "beats above range" "$insert (bpm, beats_per_bar, sound) VALUES (120, 13, 'Click');"
expect_reject "unknown sound" "$insert (bpm, beats_per_bar, sound) VALUES (120, 4, 'Laser');"
expect_reject "unknown subdivision" "$insert (bpm, beats_per_bar, sound, subdivision) VALUES (120, 4, 'Click', 'half');"
expect_reject "duration above range" "$insert (bpm, beats_per_bar, sound, duration_minutes) VALUES (120, 4, 'Click', 301);"
expect_reject "notes too long" "$insert (bpm, beats_per_bar, sound, notes) VALUES (120, 4, 'Click', printf('%.*c', 2001, 'a'));"
expect_reject "malformed timestamp" "$insert (bpm, beats_per_bar, sound, created_at) VALUES (120, 4, 'Click', 'yesterday');"
expect_reject "non-integer bpm" "$insert (bpm, beats_per_bar, sound) VALUES ('fast', 4, 'Click');"

if [ "$failures" -ne 0 ]; then
  echo "$failures schema checks failed"
  exit 1
fi
echo "All schema checks passed"
