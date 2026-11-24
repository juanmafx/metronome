import {
  SOUNDS,
  SUBDIVISIONS,
  TEMPO_LIMITS,
  type MetronomeSettings,
  type Sound,
  type Subdivision,
} from "../../metronome/domain/tempo";

export const MAX_NOTES_LENGTH = 2000;

export interface SessionFormValues {
  bpm: string;
  beatsPerBar: string;
  subdivision: Subdivision;
  sound: Sound;
  durationMinutes: string;
  notes: string;
}

export interface SessionInput extends MetronomeSettings {
  durationMinutes: number;
  notes: string;
}

export interface PracticeSession extends SessionInput {
  id: number;
  createdAt: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

export const INITIAL_FORM_VALUES: SessionFormValues = {
  bpm: "90",
  beatsPerBar: "4",
  subdivision: "quarter",
  sound: "Click",
  durationMinutes: "15",
  notes: "",
};

function parseBoundedInteger(raw: string, min: number, max: number): number | null {
  if (!/^\d{1,4}$/.test(raw.trim())) {
    return null;
  }
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

export function parseMetronomeSettings(
  values: SessionFormValues,
): ParseResult<MetronomeSettings> {
  const { bpm: bpmLimits, beatsPerBar: beatLimits } = TEMPO_LIMITS;
  const bpm = parseBoundedInteger(values.bpm, bpmLimits.min, bpmLimits.max);
  if (bpm === null) {
    return { ok: false, message: `BPM must be between ${bpmLimits.min} and ${bpmLimits.max}.` };
  }
  const beatsPerBar = parseBoundedInteger(values.beatsPerBar, beatLimits.min, beatLimits.max);
  if (beatsPerBar === null) {
    return {
      ok: false,
      message: `Beats per bar must be between ${beatLimits.min} and ${beatLimits.max}.`,
    };
  }
  if (!SUBDIVISIONS.includes(values.subdivision) || !SOUNDS.includes(values.sound)) {
    return { ok: false, message: "Choose a supported subdivision and sound." };
  }
  return {
    ok: true,
    value: { bpm, beatsPerBar, subdivision: values.subdivision, sound: values.sound },
  };
}

export function parseSessionInput(values: SessionFormValues): ParseResult<SessionInput> {
  const settings = parseMetronomeSettings(values);
  if (!settings.ok) {
    return settings;
  }
  const limits = TEMPO_LIMITS.durationMinutes;
  const durationMinutes = parseBoundedInteger(values.durationMinutes, limits.min, limits.max);
  if (durationMinutes === null) {
    return { ok: false, message: `Minutes must be between ${limits.min} and ${limits.max}.` };
  }
  const notes = values.notes.trim();
  if ([...notes].length > MAX_NOTES_LENGTH) {
    return { ok: false, message: `Notes must be at most ${MAX_NOTES_LENGTH} characters.` };
  }
  return { ok: true, value: { ...settings.value, durationMinutes, notes } };
}

export function formatSessionDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
