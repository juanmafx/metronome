# Changelog

This project follows [Semantic Versioning](https://semver.org/) and the [Keep a Changelog](https://keepachangelog.com/) format.

## [1.0.1] - 2026-11-24

### Documentation

- Corrected the release notes and security audit to reflect the published 1.0.0 release and the rewritten repository history.
- No code behaviour change.

## [1.0.0] - 2026-11-24

### Breaking

- The backend entry point moved to `backend/cmd/server`.
- The API now returns standard GraphQL `errors` instead of a single `error` field.
- Integer arguments must be real integers; numeric strings and fractions are rejected.
- `sound` and `subdivision` accept only the supported values.
- The server binds to `127.0.0.1` and only allows configured browser origins, which must be exact and lowercase.
- An operation may select `sessions` once and each session field once.
- The seeded demo session was removed, and sessions are listed newest first.

### Added

- Spec-based GraphQL parsing and validation.
- Lookahead audio scheduler with live tempo, meter and sound changes.
- Go, Vitest and SQLite schema test suites with a committed test report.
- Optional SQLite schema, CI workflow, Dependabot configuration and project documentation.
- Environment-based configuration and graceful shutdown.

### Changed

- Migrated the frontend to strict TypeScript with a feature-based structure.
- Upgraded to React 19, Vite 8, Node.js 24 and Go 1.26.11.
- Renamed the UI to "Metronome Practice Log" and corrected an unrelated page title.

### Security

- Added an origin allow-list, content-type enforcement, request limits, rate limiting, server timeouts, a production CSP and security headers. See [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).
- Bounded fragment expansion and alias amplification in the GraphQL executor, and removed schema suggestions from validation errors.

### Removed

- Tracked `node_modules`, build output, an empty stray HTML file and the remote font import.

## [0.0.1] - 2026-03-22

- Initial project import.
