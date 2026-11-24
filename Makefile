.PHONY: install test test-backend test-frontend test-schema report build audit

install:
	cd frontend && npm ci --ignore-scripts

test: test-backend test-frontend test-schema

test-backend:
	cd backend && go vet ./... && go test -race -count=1 ./...

test-frontend:
	cd frontend && npm run typecheck && npm test

test-schema:
	./scripts/verify-schema.sh

report:
	./scripts/generate-test-report.sh

build:
	cd backend && go build -trimpath -o bin/metronome-server ./cmd/server
	cd frontend && npm run build

audit:
	cd frontend && npm audit --audit-level=low
	cd backend && go run golang.org/x/vuln/cmd/govulncheck@v1.10.0 ./...
