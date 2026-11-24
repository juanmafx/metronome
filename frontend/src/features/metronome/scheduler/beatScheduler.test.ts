import { describe, expect, it } from "vitest";
import type { MetronomeSettings } from "../domain/tempo";
import { createBeatScheduler, LOOKAHEAD_SECONDS, type ScheduledStep } from "./beatScheduler";

const BASE: MetronomeSettings = { bpm: 120, beatsPerBar: 4, subdivision: "quarter", sound: "Click" };

function harness(initial: MetronomeSettings = BASE) {
  let time = 10;
  let settings = initial;
  let tick: (() => void) | null = null;
  let cleared = 0;
  const steps: ScheduledStep[] = [];
  const scheduler = createBeatScheduler({
    now: () => time,
    getSettings: () => settings,
    onStep: (step) => steps.push(step),
    setTimer: (callback) => {
      tick = callback;
      return 1;
    },
    clearTimer: () => {
      cleared += 1;
    },
  });
  return {
    scheduler,
    steps,
    advanceTo(next: number) {
      time = next;
      tick?.();
    },
    runUntil(end: number, increment = 0.025) {
      while (time < end) {
        time += increment;
        tick?.();
      }
    },
    setSettings(next: MetronomeSettings) {
      settings = next;
    },
    clearedCount: () => cleared,
  };
}

describe("beatScheduler", () => {
  it("plays the first click immediately on start", () => {
    const { scheduler, steps } = harness();
    scheduler.start();
    expect(steps[0]).toMatchObject({ time: 10, beat: 1, isAccent: true });
  });

  it("keeps exact spacing despite irregular polling", () => {
    const { scheduler, steps, runUntil } = harness();
    scheduler.start();
    runUntil(12, 0.037);
    const gaps = steps.slice(1).map((step, index) => step.time - steps[index]!.time);
    expect(gaps.length).toBeGreaterThan(2);
    gaps.forEach((gap) => expect(gap).toBeCloseTo(0.5, 9));
  });

  it("never schedules beyond the lookahead window", () => {
    const { scheduler, steps, advanceTo } = harness();
    scheduler.start();
    advanceTo(11);
    steps.forEach((step) => expect(step.time).toBeLessThan(11 + LOOKAHEAD_SECONDS));
  });

  it("cycles beats and accents across bars", () => {
    const { scheduler, steps, runUntil } = harness();
    scheduler.start();
    runUntil(12.6);
    expect(steps.slice(0, 5).map((step) => step.beat)).toEqual([1, 2, 3, 4, 1]);
    expect(steps[4]?.isAccent).toBe(true);
  });

  it("recovers without a burst after the timer stalls", () => {
    const { scheduler, steps, advanceTo } = harness();
    scheduler.start();
    const before = steps.length;
    advanceTo(60);
    expect(steps.length - before).toBeLessThanOrEqual(1);
    expect(steps.at(-1)?.time).toBeGreaterThanOrEqual(60);
  });

  it("applies tempo changes to following steps", () => {
    const { scheduler, steps, runUntil, setSettings } = harness();
    scheduler.start();
    setSettings({ ...BASE, bpm: 60 });
    runUntil(13);
    const last = steps.at(-1)!;
    const previous = steps.at(-2)!;
    expect(last.time - previous.time).toBeCloseTo(1, 9);
  });

  it("restarts the bar when the meter changes", () => {
    const { scheduler, steps, runUntil, setSettings } = harness();
    scheduler.start();
    runUntil(10.6);
    setSettings({ ...BASE, beatsPerBar: 3 });
    const before = steps.length;
    runUntil(11.2);
    expect(steps[before]).toMatchObject({ beat: 1, isAccent: true });
  });

  it("is idempotent on start and stops cleanly", () => {
    const { scheduler, steps, advanceTo, clearedCount } = harness();
    scheduler.start();
    const count = steps.length;
    scheduler.start();
    expect(steps).toHaveLength(count);
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    scheduler.stop();
    expect(clearedCount()).toBe(1);
    expect(scheduler.isRunning()).toBe(false);
    advanceTo(10);
  });
});
