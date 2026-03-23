import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const SUBDIVISION_FACTORS = {
  quarter: 1,
  eighth: 2,
  triplet: 3,
  sixteenth: 4,
};

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [bpm, setBpm] = useState(90);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [subdivision, setSubdivision] = useState("quarter");
  const [sound, setSound] = useState("Click");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const audioContextRef = useRef(null);
  const timerRef = useRef(null);
  const stepRef = useRef(0);

  useEffect(() => {
    fetch("http://localhost:8080/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query {
          sessions {
            id bpm beatsPerBar subdivision sound durationMinutes notes createdAt
          }
        }`,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const list = data?.data?.sessions;
        setSessions(Array.isArray(list) ? list : []);
        if (!Array.isArray(list) && data?.error) {
          setError(String(data.error));
        }
      })
      .catch(() => {
        setError("Backend not reachable on http://localhost:8080");
      });
  }, []);

  useEffect(() => () => stopMetronome(), []);

  function ensureAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }
    return audioContextRef.current;
  }

  function playTick(accent) {
    const ctx = ensureAudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(accent ? 0.25 : 0.17, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    const osc = ctx.createOscillator();
    osc.connect(gain);

    if (sound === "Wood") {
      osc.type = "square";
      osc.frequency.value = accent ? 1450 : 1150;
    } else if (sound === "Beep") {
      osc.type = "triangle";
      osc.frequency.value = accent ? 980 : 760;
    } else if (sound === "Cowbell") {
      osc.type = "sawtooth";
      osc.frequency.value = accent ? 820 : 620;
    } else {
      osc.type = "sine";
      osc.frequency.value = accent ? 1800 : 1350;
    }

    osc.start(now);
    osc.stop(now + 0.07);
  }

  function startMetronome() {
    if (isPlaying) return;
    setError("");
    setIsPlaying(true);
    stepRef.current = 0;

    const factor = SUBDIVISION_FACTORS[subdivision] || 1;
    const intervalMs = 60000 / (bpm * factor);
    const totalStepsInBar = beatsPerBar * factor;

    timerRef.current = window.setInterval(() => {
      const step = stepRef.current;
      const accent = step % totalStepsInBar === 0;
      const beatDisplay = Math.floor(step / factor) % beatsPerBar;
      setCurrentBeat(beatDisplay + 1);
      playTick(accent);
      stepRef.current += 1;
    }, intervalMs);
  }

  function stopMetronome() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    setCurrentBeat(0);
  }

  function createSession(e) {
    e.preventDefault();
    setError("");

    fetch("http://localhost:8080/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation(
          $bpm:Int!,
          $beatsPerBar:Int!,
          $subdivision:String!,
          $sound:String!,
          $durationMinutes:Int!,
          $notes:String!
        ){
          createSession(
            bpm:$bpm,
            beatsPerBar:$beatsPerBar,
            subdivision:$subdivision,
            sound:$sound,
            durationMinutes:$durationMinutes,
            notes:$notes
          ){
            id bpm beatsPerBar subdivision sound durationMinutes notes createdAt
          }
        }`,
        variables: {
          bpm: Number(bpm),
          beatsPerBar: Number(beatsPerBar),
          subdivision,
          sound,
          durationMinutes: Number(durationMinutes),
          notes,
        },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const created = data?.data?.createSession;
        if (!created) {
          setError(data?.error || "Failed to save session");
          return;
        }
        setSessions((prev) => [created, ...prev]);
        setNotes("");
      })
      .catch(() => {
        setError("Failed to save session. Check backend server.");
      });
  }

  return (
    <main className="page-shell">
      <section className="app-card hero-card">
        <p className="eyebrow">React + Go + GraphQL</p>
        <h1>Metronome Session Bitacora</h1>
        <p className="subtitle">
          Practice with musician-style click sounds, then log each session with notes.
        </p>
      </section>

      <section className="app-card">
        <h2>Metronome</h2>
        <p className="tempo-readout">
          {bpm} BPM · {beatsPerBar}/4 · {subdivision} · {sound}
        </p>
        <p className="beat-indicator">{isPlaying ? `Beat ${currentBeat || 1}` : "Stopped"}</p>
        <div className="button-row">
          <button type="button" onClick={startMetronome} disabled={isPlaying}>
            Start
          </button>
          <button type="button" onClick={stopMetronome} disabled={!isPlaying} className="ghost">
            Stop
          </button>
        </div>
      </section>

      <section className="app-card">
        <h2>Save Practice Session</h2>
        {error ? <p className="error-box">{error}</p> : null}

        <form onSubmit={createSession} className="session-form">
          <label>
            BPM
            <input
              type="number"
              min="30"
              max="300"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              required
            />
          </label>

          <label>
            Beats / Bar
            <input
              type="number"
              min="1"
              max="12"
              value={beatsPerBar}
              onChange={(e) => setBeatsPerBar(e.target.value)}
              required
            />
          </label>

          <label>
            Subdivision
            <select value={subdivision} onChange={(e) => setSubdivision(e.target.value)}>
              <option value="quarter">Quarter</option>
              <option value="eighth">Eighth</option>
              <option value="triplet">Triplet</option>
              <option value="sixteenth">Sixteenth</option>
            </select>
          </label>

          <label>
            Sound
            <select value={sound} onChange={(e) => setSound(e.target.value)}>
              <option value="Click">Click</option>
              <option value="Wood">Wood</option>
              <option value="Beep">Beep</option>
              <option value="Cowbell">Cowbell</option>
            </select>
          </label>

          <label>
            Minutes
            <input
              type="number"
              min="0"
              max="300"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
            />
          </label>

          <label className="notes-field">
            Notes
            <textarea
              placeholder="How did it feel, what should improve, what tempo target is next?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <button type="submit">Save Session</button>
        </form>
      </section>

      <section className="app-card">
        <h2>Session History</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Tempo</th>
                <th>Meter</th>
                <th>Subdivision</th>
                <th>Sound</th>
                <th>Minutes</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{new Date(session.createdAt).toLocaleString()}</td>
                  <td>{session.bpm} BPM</td>
                  <td>{session.beatsPerBar}/4</td>
                  <td>{session.subdivision}</td>
                  <td>{session.sound}</td>
                  <td>{session.durationMinutes}</td>
                  <td>{session.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
