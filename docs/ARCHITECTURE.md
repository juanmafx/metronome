# Architecture

## Overview

The system has two deployable parts: a static React single-page app and a Go GraphQL service. Audio runs entirely in the browser, so playback keeps working if the API is down; only loading and saving sessions need the backend.

## Backend

Dependencies point inward:

```text
cmd/server -> internal/httpapi -> internal/graphql -> internal/session
          \-> internal/config
```

| Package | Responsibility |
| --- | --- |
| `cmd/server` | Wires dependencies, sets server timeouts, handles graceful shutdown |
| `internal/config` | Parses and validates environment variables; fails fast at startup |
| `internal/httpapi` | Routing, origin policy, content-type enforcement, body limits, rate limiting, security headers |
| `internal/graphql` | Parses and validates operations against the schema, then executes them |
| `internal/session` | Domain rules and a mutex-protected, bounded in-memory store |

### GraphQL execution

Operations are parsed and validated by [`gqlparser`](https://github.com/vektah/gqlparser). A small purpose-built executor then resolves fields, including aliases, fragments, `@skip` and `@include`. Cost is bounded by a body limit, a token limit, a root field limit and a rule allowing one mutation field per operation. Introspection is disabled.

```graphql
type Session {
  id: Int!
  bpm: Int!
  beatsPerBar: Int!
  subdivision: String!
  sound: String!
  durationMinutes: Int!
  notes: String!
  createdAt: String!
}

type Query {
  sessions: [Session!]!
}

type Mutation {
  createSession(
    bpm: Int!
    beatsPerBar: Int!
    subdivision: String
    sound: String!
    durationMinutes: Int
    notes: String
  ): Session!
}
```

## Frontend

Code is organized by feature, and each feature separates pure logic from React:

```text
src/
  app/                  Composition root
  features/
    metronome/
      domain/           Tempo math
      scheduler/        Lookahead scheduler
      audio/            Web Audio click synthesis
      hooks/            React lifecycle binding
      components/       Presentation
    sessions/
      domain/           Form parsing and formatting
      api/              GraphQL operations
      hooks/            Loading and saving state
      components/       Presentation
  shared/api/           Transport client
  styles/               Global styles
```

### Timing model

`setInterval` alone drifts and jitters. The scheduler polls every 25 ms and queues any click due in the next 120 ms at an exact `AudioContext` timestamp, so polling jitter does not reach the audio. After a stall it resumes from the current time rather than playing a burst of missed clicks.

## Data model

Sessions live in memory today. `db/schema.sql` defines the equivalent SQLite table, with `CHECK` constraints mirroring the domain rules so that a future persistent store has a second line of defense.

## Recommended evolution

1. Add a `session.Repository` interface and a SQLite implementation that uses parameterized queries and `db/schema.sql`.
2. Add authentication and per-user ownership before any non-local deployment.
3. Terminate TLS at a reverse proxy, serve the static frontend from the same origin, and move the CSP to a response header.
4. Move the scheduler to a Web Worker to reduce background-tab throttling.
