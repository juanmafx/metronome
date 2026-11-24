# Security Audit

- **Date:** 2026-11-23
- **Scope:** all first-party code, dependencies, build configuration and tracked files on `modernize/2026`
- **Method:** manual code review, `npm audit`, `govulncheck`, a pattern search for secrets in the tracked tree, automated tests, and a headless Chrome run against the real backend and production build

This is a self-review, not an independent penetration test.

## Fixed

| Severity | Finding | Remediation |
| --- | --- | --- |
| High | CORS allowed any origin, so any website could read and write a local user's data | Exact origin allow-list; other origins receive 403 |
| High | The server listened on all network interfaces | Binds to `127.0.0.1` by default; warns on non-loopback addresses |
| High | Unsynchronized shared state caused data races | Mutex-protected store, verified with the race detector |
| High | Unbounded bodies and storage allowed memory exhaustion | 64 KiB body limit, token and root field limits, bounded store |
| Medium | Cross-site requests could use simple content types | `application/json` is required |
| Medium | No HTTP timeouts exposed the server to slow-client attacks | Read, write, header and idle timeouts |
| Medium | Operations were routed by substring match | Full parsing and schema validation |
| Medium | Free-form `sound` and `subdivision`, and unbounded `notes` | Allow-lists, a length limit and control character rejection |
| Medium | No request throttling | Per-client rate limit with bounded memory |
| Medium | Outdated frontend toolchain | React 19, Vite 8, exact versions and a committed lockfile |
| Medium | Standard library advisories reachable in Go 1.26.8 | Requires Go 1.26.11 |
| Low | Third-party font loading exposed visitor IPs | System font stack |
| Low | No browser hardening | Strict CSP in production builds, API security headers |
| Low | `node_modules`, native binaries and build output were tracked | Removed from the tree and ignored |

## Verification

| Check | Result |
| --- | --- |
| `npm audit` | 0 vulnerabilities |
| `govulncheck` | No vulnerabilities found |
| Secret pattern search | No matches in first-party files |
| Stored markup rendered in the browser | Inert text, no script execution |
| Production build under CSP | No violations in headless Chrome |

## Open items

| Severity | Item | Status |
| --- | --- | --- |
| Medium | The API has no authentication | Accepted for local use; required before any network deployment |
| Low | Removed dependencies and build output remain in git history | A pattern search found no secrets; rewriting history is an owner decision |
| Low | Sessions are not persisted or encrypted at rest | By design; data exists only in process memory |
