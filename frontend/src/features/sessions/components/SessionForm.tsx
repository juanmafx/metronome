import type { FormEvent } from "react";
import { SOUNDS, SUBDIVISIONS, TEMPO_LIMITS } from "../../metronome/domain/tempo";
import { MAX_NOTES_LENGTH, type SessionFormValues } from "../domain/sessionDraft";

interface SessionFormProps {
  values: SessionFormValues;
  error: string;
  isSaving: boolean;
  onChange: (patch: Partial<SessionFormValues>) => void;
  onSubmit: () => void;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SessionForm({ values, error, isSaving, onChange, onSubmit }: SessionFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="app-card" aria-labelledby="save-session-heading">
      <h2 id="save-session-heading">Save Practice Session</h2>
      {error ? (
        <p className="error-box" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="session-form">
        <label>
          BPM
          <input
            type="number"
            min={TEMPO_LIMITS.bpm.min}
            max={TEMPO_LIMITS.bpm.max}
            value={values.bpm}
            onChange={(event) => onChange({ bpm: event.target.value })}
            required
          />
        </label>
        <label>
          Beats / Bar
          <input
            type="number"
            min={TEMPO_LIMITS.beatsPerBar.min}
            max={TEMPO_LIMITS.beatsPerBar.max}
            value={values.beatsPerBar}
            onChange={(event) => onChange({ beatsPerBar: event.target.value })}
            required
          />
        </label>
        <label>
          Subdivision
          <select
            value={values.subdivision}
            onChange={(event) =>
              onChange({ subdivision: event.target.value as SessionFormValues["subdivision"] })
            }
          >
            {SUBDIVISIONS.map((subdivision) => (
              <option key={subdivision} value={subdivision}>
                {capitalize(subdivision)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sound
          <select
            value={values.sound}
            onChange={(event) =>
              onChange({ sound: event.target.value as SessionFormValues["sound"] })
            }
          >
            {SOUNDS.map((sound) => (
              <option key={sound} value={sound}>
                {sound}
              </option>
            ))}
          </select>
        </label>
        <label>
          Minutes
          <input
            type="number"
            min={TEMPO_LIMITS.durationMinutes.min}
            max={TEMPO_LIMITS.durationMinutes.max}
            value={values.durationMinutes}
            onChange={(event) => onChange({ durationMinutes: event.target.value })}
            required
          />
        </label>
        <label className="notes-field">
          Notes
          <textarea
            placeholder="How did it feel, what should improve, what tempo target is next?"
            maxLength={MAX_NOTES_LENGTH}
            value={values.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
          />
        </label>
        <button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Session"}
        </button>
      </form>
    </section>
  );
}
