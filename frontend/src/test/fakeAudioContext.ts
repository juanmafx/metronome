export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = "suspended";
  currentTime = 0;
  destination = {};
  oscillators: { type: string; frequency: { value: number }; startedAt: number }[] = [];
  closed = false;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  async resume() {
    this.state = "running";
  }

  async close() {
    this.closed = true;
  }

  createGain() {
    return {
      connect: () => undefined,
      disconnect: () => undefined,
      gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
    };
  }

  createOscillator() {
    const oscillator = {
      type: "sine",
      frequency: { value: 0 },
      startedAt: -1,
      onended: null,
      connect: () => undefined,
      disconnect: () => undefined,
      start: (time: number) => {
        oscillator.startedAt = time;
      },
      stop: () => undefined,
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }
}
