import { graphqlRequest } from "../../../shared/api/graphqlClient";
import type { PracticeSession, SessionInput } from "../domain/sessionDraft";

const SESSION_FIELDS = "id bpm beatsPerBar subdivision sound durationMinutes notes createdAt";

const LIST_SESSIONS = `query ListSessions { sessions { ${SESSION_FIELDS} } }`;

const CREATE_SESSION = `mutation CreateSession(
  $bpm: Int!
  $beatsPerBar: Int!
  $subdivision: String!
  $sound: String!
  $durationMinutes: Int!
  $notes: String!
) {
  createSession(
    bpm: $bpm
    beatsPerBar: $beatsPerBar
    subdivision: $subdivision
    sound: $sound
    durationMinutes: $durationMinutes
    notes: $notes
  ) { ${SESSION_FIELDS} }
}`;

export async function listSessions(signal?: AbortSignal): Promise<PracticeSession[]> {
  const data = await graphqlRequest<{ sessions: PracticeSession[] }>(LIST_SESSIONS, {}, signal);
  return data.sessions;
}

export async function createSession(input: SessionInput): Promise<PracticeSession> {
  const data = await graphqlRequest<{ createSession: PracticeSession }>(CREATE_SESSION, {
    ...input,
  });
  return data.createSession;
}
