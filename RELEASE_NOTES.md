# Release Notes: v1.0.0

Version 1.0.0 rebuilds the original prototype into a tested, typed application with explicit request limits. The product is the same: a browser metronome with a practice log.

## Highlights

- **Audio-clock scheduling:** clicks are queued at exact audio timestamps, and settings can change during playback.
- **Validated GraphQL:** operations are parsed and validated instead of matched by substring.
- **API safeguards:** origin allow-list, request and query cost limits, rate limiting, timeouts and loopback binding by default.
- **Modern stack:** React 19, strict TypeScript, Vite 8, Node.js 24 and Go 1.26.11.
- **Tests and CI:** backend, frontend and schema suites, with results in `reports/tests/`.

## Upgrade notes

- Start the backend with `go run ./cmd/server` from `backend/`.
- API clients must read the GraphQL `errors` array and send integers as JSON numbers.
- Browser clients on other origins must be listed in `METRONOME_ALLOWED_ORIGINS` as exact lowercase origins.
- An operation may select `sessions` once and each session field once.

## Known limitations

- Sessions are stored in memory and are lost on restart.
- The API has no authentication and should not be exposed to a network as is.
- Playback can stutter in background tabs because browsers throttle timers.
