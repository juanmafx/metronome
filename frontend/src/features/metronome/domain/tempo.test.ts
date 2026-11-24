import { describe, expect, it } from "vitest";
import { describeStep, stepDurationSeconds, stepsPerBar } from "./tempo";

describe("tempo", () => {
  it.each([
    [60, "quarter", 1],
    [120, "quarter", 0.5],
    [120, "eighth", 0.25],
    [60, "triplet", 1 / 3],
    [60, "sixteenth", 0.25],
  ] as const)("computes step length at %d BPM %s", (bpm, subdivision, expected) => {
    expect(stepDurationSeconds(bpm, subdivision)).toBeCloseTo(expected, 10);
  });

  it("counts steps per bar", () => {
    expect(stepsPerBar(4, "quarter")).toBe(4);
    expect(stepsPerBar(3, "triplet")).toBe(9);
  });

  it("accents only the first step of each bar", () => {
    const accents = Array.from({ length: 16 }, (_, step) => describeStep(step, 4, "eighth").isAccent);
    expect(accents.flatMap((isAccent, step) => (isAccent ? [step] : []))).toEqual([0, 8]);
  });

  it("maps subdivided steps to the containing beat", () => {
    const beats = Array.from({ length: 6 }, (_, step) => describeStep(step, 2, "triplet").beat);
    expect(beats).toEqual([1, 1, 1, 2, 2, 2]);
  });
});
