# Release Notes: v1.0.1

Version 1.0.1 is a documentation-only release. It contains no code behaviour change from 1.0.0.

## Changes

- The changelog dates the published 1.0.0 release.
- The security audit marks the finding about removed dependencies and build output remaining in git history as resolved. On 2026-11-24 the public history was rewritten to keep only the 2026 modernization commits.

## Upgrading

No action is needed when upgrading from 1.0.0. For the changes introduced in 1.0.0, see [CHANGELOG.md](CHANGELOG.md).

## Known limitations

- Sessions are stored in memory and are lost on restart.
- The API has no authentication and should not be exposed to a network as is.
- Playback can stutter in background tabs because browsers throttle timers.
