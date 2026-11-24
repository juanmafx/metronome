import type { MetronomeControls } from "../hooks/useMetronome";

interface MetronomePanelProps {
  readout: string;
  controls: MetronomeControls;
  canStart: boolean;
}

export function MetronomePanel({ readout, controls, canStart }: MetronomePanelProps) {
  const { isPlaying, currentBeat, audioError, start, stop } = controls;
  return (
    <section className="app-card" aria-labelledby="metronome-heading">
      <h2 id="metronome-heading">Metronome</h2>
      {audioError ? (
        <p className="error-box" role="alert">
          {audioError}
        </p>
      ) : null}
      <p className="tempo-readout">{readout}</p>
      <p className="beat-indicator" aria-live="off">
        {isPlaying ? `Beat ${currentBeat || 1}` : "Stopped"}
      </p>
      <div className="button-row">
        <button type="button" onClick={() => void start()} disabled={isPlaying || !canStart}>
          Start
        </button>
        <button type="button" onClick={stop} disabled={!isPlaying} className="ghost">
          Stop
        </button>
      </div>
    </section>
  );
}
