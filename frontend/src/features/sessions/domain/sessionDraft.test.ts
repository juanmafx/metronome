import { describe, expect, it } from "vitest";
import {
  formatSessionDate,
  INITIAL_FORM_VALUES,
  MAX_NOTES_LENGTH,
  parseMetronomeSettings,
  parseSessionInput,
  type SessionFormValues,
} from "./sessionDraft";

const withValues = (patch: Partial<SessionFormValues>): SessionFormValues => ({
  ...INITIAL_FORM_VALUES,
  ...patch,
});

describe("sessionDraft", () => {
  it("parses valid values to numbers and trims notes", () => {
    const parsed = parseSessionInput(withValues({ bpm: "120", notes: "  steady " }));
    expect(parsed).toEqual({
      ok: true,
      value: {
        bpm: 120,
        beatsPerBar: 4,
        subdivision: "quarter",
        sound: "Click",
        durationMinutes: 15,
        notes: "steady",
      },
    });
  });

  it.each(["", "29", "301", "12.5", "-90", "1e2", "abc", "99999"])("rejects BPM %j", (bpm) => {
    expect(parseMetronomeSettings(withValues({ bpm })).ok).toBe(false);
  });

  it.each(["0", "13"])("rejects beats per bar %s", (beatsPerBar) => {
    expect(parseMetronomeSettings(withValues({ beatsPerBar })).ok).toBe(false);
  });

  it.each(["-1", "301", ""])("rejects minutes %j", (durationMinutes) => {
    expect(parseSessionInput(withValues({ durationMinutes })).ok).toBe(false);
  });

  it("rejects unsupported sounds", () => {
    const values = { ...INITIAL_FORM_VALUES, sound: "Laser" } as unknown as SessionFormValues;
    expect(parseMetronomeSettings(values).ok).toBe(false);
  });

  it("enforces the notes limit", () => {
    expect(parseSessionInput(withValues({ notes: "a".repeat(MAX_NOTES_LENGTH) })).ok).toBe(true);
    expect(parseSessionInput(withValues({ notes: "a".repeat(MAX_NOTES_LENGTH + 1) })).ok).toBe(false);
  });

  it("formats dates in English and tolerates invalid input", () => {
    expect(formatSessionDate("2026-03-22T12:00:00Z")).toContain("2026");
    expect(formatSessionDate("not-a-date")).toBe("Unknown");
  });
});
