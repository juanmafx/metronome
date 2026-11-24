import { useCallback, useEffect, useRef, useState } from "react";
import { playClick } from "../audio/clickPlayer";
import type { MetronomeSettings } from "../domain/tempo";
import { createBeatScheduler, type BeatScheduler } from "../scheduler/beatScheduler";

export interface MetronomeControls {
  isPlaying: boolean;
  currentBeat: number;
  audioError: string;
  start: () => Promise<void>;
  stop: () => void;
}

export function useMetronome(settings: MetronomeSettings | null): MetronomeControls {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [audioError, setAudioError] = useState("");
  const contextRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<BeatScheduler | null>(null);
  const settingsRef = useRef<MetronomeSettings | null>(settings);
  const beatTimersRef = useRef(new Set<number>());
  const startAttemptRef = useRef(0);
  const isStartingRef = useRef(false);

  useEffect(() => {
    if (settings) {
      settingsRef.current = settings;
    }
  }, [settings]);

  const clearBeatTimers = useCallback(() => {
    beatTimersRef.current.forEach((id) => window.clearTimeout(id));
    beatTimersRef.current.clear();
  }, []);

  const stop = useCallback(() => {
    startAttemptRef.current += 1;
    isStartingRef.current = false;
    schedulerRef.current?.stop();
    schedulerRef.current = null;
    clearBeatTimers();
    setIsPlaying(false);
    setCurrentBeat(0);
  }, [clearBeatTimers]);

  const start = useCallback(async () => {
    const initial = settings ?? null;
    if (schedulerRef.current || isStartingRef.current || !initial) {
      return;
    }
    isStartingRef.current = true;
    startAttemptRef.current += 1;
    const attempt = startAttemptRef.current;
    settingsRef.current = initial;
    setAudioError("");
    try {
      contextRef.current ??= new window.AudioContext();
      const context = contextRef.current;
      if (context.state === "suspended") {
        await context.resume();
      }
      if (attempt !== startAttemptRef.current) {
        return;
      }
      const scheduler = createBeatScheduler({
        now: () => context.currentTime,
        getSettings: () => settingsRef.current ?? initial,
        onStep: ({ time, beat, isAccent, settings: active }) => {
          playClick(context, time, active.sound, isAccent);
          const delayMs = Math.max(0, (time - context.currentTime) * 1000);
          const timerId = window.setTimeout(() => {
            beatTimersRef.current.delete(timerId);
            setCurrentBeat(beat);
          }, delayMs);
          beatTimersRef.current.add(timerId);
        },
      });
      schedulerRef.current = scheduler;
      scheduler.start();
      setIsPlaying(true);
    } catch {
      if (attempt === startAttemptRef.current) {
        schedulerRef.current?.stop();
        schedulerRef.current = null;
        setAudioError("Audio could not be started in this browser.");
      }
    } finally {
      if (attempt === startAttemptRef.current) {
        isStartingRef.current = false;
      }
    }
  }, [settings]);

  useEffect(
    () => () => {
      startAttemptRef.current += 1;
      isStartingRef.current = false;
      schedulerRef.current?.stop();
      schedulerRef.current = null;
      clearBeatTimers();
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [clearBeatTimers],
  );

  return { isPlaying, currentBeat, audioError, start, stop };
}
