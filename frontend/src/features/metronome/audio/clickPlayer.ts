import type { Sound } from "../domain/tempo";

const CLICK_LENGTH_SECONDS = 0.07;
const ACCENT_GAIN = 0.25;
const REGULAR_GAIN = 0.17;
const SILENCE_GAIN = 0.0001;

interface SoundProfile {
  waveform: OscillatorType;
  accentHz: number;
  regularHz: number;
}

export const SOUND_PROFILES: Record<Sound, SoundProfile> = {
  Click: { waveform: "sine", accentHz: 1800, regularHz: 1350 },
  Wood: { waveform: "square", accentHz: 1450, regularHz: 1150 },
  Beep: { waveform: "triangle", accentHz: 980, regularHz: 760 },
  Cowbell: { waveform: "sawtooth", accentHz: 820, regularHz: 620 },
};

export function playClick(
  context: AudioContext,
  time: number,
  sound: Sound,
  isAccent: boolean,
): void {
  const profile = SOUND_PROFILES[sound];
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(isAccent ? ACCENT_GAIN : REGULAR_GAIN, time);
  gain.gain.exponentialRampToValueAtTime(SILENCE_GAIN, time + CLICK_LENGTH_SECONDS);

  const oscillator = context.createOscillator();
  oscillator.type = profile.waveform;
  oscillator.frequency.value = isAccent ? profile.accentHz : profile.regularHz;
  oscillator.connect(gain);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(time);
  oscillator.stop(time + CLICK_LENGTH_SECONDS);
}
