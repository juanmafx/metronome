import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeAudioContext } from "../../../test/fakeAudioContext";
import type { MetronomeSettings } from "../domain/tempo";
import { useMetronome } from "./useMetronome";

const SETTINGS: MetronomeSettings = { bpm: 90, beatsPerBar: 4, subdivision: "quarter", sound: "Click" };

class DeferredAudioContext extends FakeAudioContext {
  static release: () => void = () => undefined;

  override resume() {
    return new Promise<void>((resolve) => {
      DeferredAudioContext.release = () => {
        this.state = "running";
        resolve();
      };
    });
  }
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", DeferredAudioContext);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useMetronome", () => {
  it("starts a single scheduler when start is called twice during resume", async () => {
    const { result } = renderHook(() => useMetronome(SETTINGS));
    let pending: Promise<void>[] = [];
    act(() => {
      pending = [result.current.start(), result.current.start()];
    });
    await act(async () => {
      DeferredAudioContext.release();
      await Promise.all(pending);
    });
    expect(result.current.isPlaying).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0]?.oscillators).toHaveLength(1);
  });

  it("stays stopped when stop is called during resume", async () => {
    const { result } = renderHook(() => useMetronome(SETTINGS));
    let pending = Promise.resolve();
    act(() => {
      pending = result.current.start();
      result.current.stop();
    });
    await act(async () => {
      DeferredAudioContext.release();
      await pending;
    });
    expect(result.current.isPlaying).toBe(false);
    expect(FakeAudioContext.instances[0]?.oscillators).toHaveLength(0);
  });

  it("can start again after stopping during resume", async () => {
    const { result } = renderHook(() => useMetronome(SETTINGS));
    let pending = Promise.resolve();
    act(() => {
      pending = result.current.start();
      result.current.stop();
    });
    await act(async () => {
      DeferredAudioContext.release();
      await pending;
    });
    await act(async () => {
      const restarted = result.current.start();
      DeferredAudioContext.release();
      await restarted;
    });
    expect(result.current.isPlaying).toBe(true);
  });
});
