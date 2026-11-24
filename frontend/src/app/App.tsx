import { useMemo, useState } from "react";
import { MetronomePanel } from "../features/metronome/components/MetronomePanel";
import { useMetronome } from "../features/metronome/hooks/useMetronome";
import { SessionForm } from "../features/sessions/components/SessionForm";
import { SessionHistory } from "../features/sessions/components/SessionHistory";
import {
  INITIAL_FORM_VALUES,
  parseMetronomeSettings,
  parseSessionInput,
  type SessionFormValues,
} from "../features/sessions/domain/sessionDraft";
import { useSessions } from "../features/sessions/hooks/useSessions";

export function App() {
  const [values, setValues] = useState<SessionFormValues>(INITIAL_FORM_VALUES);
  const [saveError, setSaveError] = useState("");
  const { sessions, loadError, isSaving, save } = useSessions();

  const parsedSettings = useMemo(() => parseMetronomeSettings(values), [values]);
  const settings = parsedSettings.ok ? parsedSettings.value : null;
  const controls = useMetronome(settings);

  const readout = parsedSettings.ok
    ? `${parsedSettings.value.bpm} BPM · ${parsedSettings.value.beatsPerBar}/4 · ${parsedSettings.value.subdivision} · ${parsedSettings.value.sound}`
    : parsedSettings.message;

  async function handleSubmit() {
    setSaveError("");
    const parsed = parseSessionInput(values);
    if (!parsed.ok) {
      setSaveError(parsed.message);
      return;
    }
    const failure = await save(parsed.value);
    if (failure) {
      setSaveError(failure);
      return;
    }
    setValues((current) => ({ ...current, notes: "" }));
  }

  return (
    <main className="page-shell">
      <section className="app-card hero-card">
        <p className="eyebrow">React + Go + GraphQL</p>
        <h1>Metronome Practice Log</h1>
        <p className="subtitle">
          Practice with musician-style click sounds, then log each session with notes.
        </p>
      </section>
      <MetronomePanel readout={readout} controls={controls} canStart={settings !== null} />
      <SessionForm
        values={values}
        error={saveError || loadError}
        isSaving={isSaving}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
        onSubmit={() => void handleSubmit()}
      />
      <SessionHistory sessions={sessions} />
    </main>
  );
}
