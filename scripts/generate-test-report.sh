#!/usr/bin/env bash
# Runs every test suite and writes the results to reports/tests/.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$root/reports/tests"
mkdir -p "$out"

(cd "$root/backend" && go test -race -cover -count=1 -v ./...) >"$out/backend-go-test.txt" 2>&1
backend_status=$?

(cd "$root/frontend" && npx vitest run --reporter=default --reporter=junit --outputFile.junit="$out/frontend-junit.xml") >/dev/null 2>&1
frontend_status=$?
sed -i -E "s/ hostname=\"[^\"]*\"//; s#$root/##g" "$out/frontend-junit.xml"

"$root/scripts/verify-schema.sh" >"$out/schema-check.txt" 2>&1
schema_status=$?

backend_passed=$(grep -cE '^\s*--- PASS' "$out/backend-go-test.txt")
backend_failed=$(grep -cE '^\s*--- FAIL' "$out/backend-go-test.txt")
frontend_total=$(grep -m1 -oE '<testsuites [^>]*' "$out/frontend-junit.xml" | grep -oE ' tests="[0-9]+"' | grep -oE '[0-9]+')
frontend_failed=$(grep -m1 -oE '<testsuites [^>]*' "$out/frontend-junit.xml" | grep -oE ' failures="[0-9]+"' | grep -oE '[0-9]+')
frontend_errors=$(grep -m1 -oE '<testsuites [^>]*' "$out/frontend-junit.xml" | grep -oE ' errors="[0-9]+"' | grep -oE '[0-9]+')
frontend_failed=$((frontend_failed + frontend_errors))
frontend_passed=$((frontend_total - frontend_failed))
schema_passed=$(grep -c '^PASS' "$out/schema-check.txt")
schema_failed=$(grep -c '^FAIL' "$out/schema-check.txt")

{
  echo "# Test Report"
  echo
  echo "- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- Go: $(cd "$root/backend" && go env GOVERSION)"
  echo "- Node.js: $(node --version)"
  echo "- SQLite: $(sqlite3 --version | cut -d' ' -f1)"
  echo
  echo "| Suite | Passed | Failed | Exit code | Raw output |"
  echo "| --- | ---: | ---: | ---: | --- |"
  echo "| Backend (Go, race detector) | $backend_passed | $backend_failed | $backend_status | [backend-go-test.txt](backend-go-test.txt) |"
  echo "| Frontend (Vitest) | $frontend_passed | $frontend_failed | $frontend_status | [frontend-junit.xml](frontend-junit.xml) |"
  echo "| Database schema (SQLite) | $schema_passed | $schema_failed | $schema_status | [schema-check.txt](schema-check.txt) |"
  echo
  echo "Backend counts include subtests."
} >"$out/SUMMARY.md"

cat "$out/SUMMARY.md"
[ "$backend_status" -eq 0 ] && [ "$frontend_status" -eq 0 ] && [ "$schema_status" -eq 0 ]
