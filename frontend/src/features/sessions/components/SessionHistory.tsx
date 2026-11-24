import { formatSessionDate, type PracticeSession } from "../domain/sessionDraft";

interface SessionHistoryProps {
  sessions: PracticeSession[];
}

export function SessionHistory({ sessions }: SessionHistoryProps) {
  return (
    <section className="app-card" aria-labelledby="history-heading">
      <h2 id="history-heading">Session History</h2>
      {sessions.length === 0 ? (
        <p className="empty-history">No sessions saved yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Tempo</th>
                <th scope="col">Meter</th>
                <th scope="col">Subdivision</th>
                <th scope="col">Sound</th>
                <th scope="col">Minutes</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{formatSessionDate(session.createdAt)}</td>
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
      )}
    </section>
  );
}
