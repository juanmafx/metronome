import { useCallback, useEffect, useState } from "react";
import { createSession, listSessions } from "../api/sessionsApi";
import type { PracticeSession, SessionInput } from "../domain/sessionDraft";

export interface SessionsState {
  sessions: PracticeSession[];
  loadError: string;
  isSaving: boolean;
  save: (input: SessionInput) => Promise<string | null>;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useSessions(): SessionsState {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listSessions(controller.signal)
      .then((loaded) => {
        setSessions(loaded);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(messageFrom(error, "Sessions could not be loaded."));
        }
      });
    return () => controller.abort();
  }, []);

  const save = useCallback(async (input: SessionInput) => {
    setIsSaving(true);
    try {
      const created = await createSession(input);
      setSessions((previous) => [created, ...previous]);
      return null;
    } catch (error) {
      return messageFrom(error, "The session could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { sessions, loadError, isSaving, save };
}
