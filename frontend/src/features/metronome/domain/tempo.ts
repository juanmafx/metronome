export const TEMPO_LIMITS = {
  bpm: { min: 30, max: 300 },
  beatsPerBar: { min: 1, max: 12 },
  durationMinutes: { min: 0, max: 300 },
} as const;

export const SUBDIVISION_FACTORS = {
  quarter: 1,
  eighth: 2,
  triplet: 3,
  sixteenth: 4,
} as const;

export type Subdivision = keyof typeof SUBDIVISION_FACTORS;

export const SUBDIVISIONS = Object.keys(SUBDIVISION_FACTORS) as Subdivision[];

export const SOUNDS = ["Click", "Wood", "Beep", "Cowbell"] as const;

export type Sound = (typeof SOUNDS)[number];

export interface MetronomeSettings {
  bpm: number;
  beatsPerBar: number;
  subdivision: Subdivision;
  sound: Sound;
}

export interface StepPosition {
  beat: number;
  isAccent: boolean;
}

export function stepDurationSeconds(bpm: number, subdivision: Subdivision): number {
  return 60 / (bpm * SUBDIVISION_FACTORS[subdivision]);
}

export function stepsPerBar(beatsPerBar: number, subdivision: Subdivision): number {
  return beatsPerBar * SUBDIVISION_FACTORS[subdivision];
}

export function describeStep(
  step: number,
  beatsPerBar: number,
  subdivision: Subdivision,
): StepPosition {
  const stepInBar = step % stepsPerBar(beatsPerBar, subdivision);
  return {
    beat: Math.floor(stepInBar / SUBDIVISION_FACTORS[subdivision]) + 1,
    isAccent: stepInBar === 0,
  };
}
