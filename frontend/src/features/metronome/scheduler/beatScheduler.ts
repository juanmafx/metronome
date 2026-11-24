import {
  describeStep,
  stepDurationSeconds,
  stepsPerBar,
  type MetronomeSettings,
  type StepPosition,
} from "../domain/tempo";

export const LOOKAHEAD_SECONDS = 0.12;
export const POLL_INTERVAL_MS = 25;

export interface ScheduledStep extends StepPosition {
  time: number;
  settings: MetronomeSettings;
}

export interface BeatSchedulerOptions {
  now: () => number;
  getSettings: () => MetronomeSettings;
  onStep: (step: ScheduledStep) => void;
  setTimer?: (callback: () => void, intervalMs: number) => number;
  clearTimer?: (id: number) => void;
}

export interface BeatScheduler {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

export function createBeatScheduler({
  now,
  getSettings,
  onStep,
  setTimer = (callback, intervalMs) => window.setInterval(callback, intervalMs),
  clearTimer = (id) => window.clearInterval(id),
}: BeatSchedulerOptions): BeatScheduler {
  let timerId: number | null = null;
  let step = 0;
  let nextTime = 0;
  let meterKey = "";

  function pump(): void {
    const current = now();
    if (nextTime < current) {
      nextTime = current;
    }
    while (nextTime < current + LOOKAHEAD_SECONDS) {
      const settings = getSettings();
      const key = `${settings.beatsPerBar}:${settings.subdivision}`;
      if (key !== meterKey) {
        meterKey = key;
        step = 0;
      }
      onStep({
        ...describeStep(step, settings.beatsPerBar, settings.subdivision),
        time: nextTime,
        settings,
      });
      step = (step + 1) % stepsPerBar(settings.beatsPerBar, settings.subdivision);
      nextTime += stepDurationSeconds(settings.bpm, settings.subdivision);
    }
  }

  return {
    start() {
      if (timerId !== null) {
        return;
      }
      step = 0;
      meterKey = "";
      nextTime = now();
      pump();
      timerId = setTimer(pump, POLL_INTERVAL_MS);
    },
    stop() {
      if (timerId !== null) {
        clearTimer(timerId);
        timerId = null;
      }
    },
    isRunning: () => timerId !== null,
  };
}
