import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeAudioContext } from "../test/fakeAudioContext";
import { App } from "./App";

const STORED = {
  id: 1,
  bpm: 100,
  beatsPerBar: 3,
  subdivision: "eighth",
  sound: "Wood",
  durationMinutes: 20,
  notes: "stored note",
  createdAt: "2026-03-22T00:00:00Z",
};

type Reply = { data?: unknown; errors?: { message: string }[] };

function mockApi(onCreate: (variables: Record<string, unknown>) => Reply, initial = [STORED]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    const { query, variables } = JSON.parse(String(init?.body));
    const reply = query.includes("mutation") ? onCreate(variables) : { data: { sessions: initial } };
    return new Response(JSON.stringify(reply));
  });
}

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders stored sessions", async () => {
    mockApi(() => ({}));
    render(<App />);
    expect(await screen.findByText("stored note")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Metronome Practice Log" })).toBeTruthy();
  });

  it("shows an empty state", async () => {
    const fetchMock = mockApi(() => ({}), []);
    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByText("No sessions saved yet.")).toBeTruthy();
  });

  it("reports an unreachable server", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("failed"));
    render(<App />);
    expect((await screen.findByRole("alert")).textContent).toBe("The server could not be reached.");
  });

  it("saves a session with numeric variables and clears notes", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn((variables: Record<string, unknown>) => ({
      data: { createSession: { ...STORED, ...variables, id: 2, createdAt: STORED.createdAt } },
    }));
    mockApi(onCreate);
    render(<App />);
    await screen.findByText("stored note");

    const notes = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    await user.type(notes, "new note");
    await user.click(screen.getByRole("button", { name: "Save Session" }));

    expect(await screen.findByText("new note")).toBeTruthy();
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ bpm: 90, beatsPerBar: 4, notes: "new note" });
    expect(notes.value).toBe("");
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("new note")).toBeTruthy();
  });

  it("shows server validation errors and keeps the draft", async () => {
    const user = userEvent.setup();
    mockApi(() => ({ data: null, errors: [{ message: "session storage limit reached" }] }));
    render(<App />);
    await screen.findByText("stored note");
    const notes = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    await user.type(notes, "keep me");
    await user.click(screen.getByRole("button", { name: "Save Session" }));
    expect((await screen.findByRole("alert")).textContent).toContain("limit reached");
    expect(notes.value).toBe("keep me");
  });

  it("renders stored markup as inert text", async () => {
    const payload = '<img src=x onerror="alert(1)">';
    mockApi(() => ({}), [{ ...STORED, notes: payload }]);
    const { container } = render(<App />);
    expect(await screen.findByText(payload)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("starts and stops audio", async () => {
    const user = userEvent.setup();
    mockApi(() => ({}));
    render(<App />);
    await screen.findByText("stored note");

    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(screen.queryByText("Stopped")).toBeNull());
    const context = FakeAudioContext.instances[0]!;
    expect(context.state).toBe("running");
    expect(context.oscillators[0]?.frequency.value).toBe(1800);

    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(await screen.findByText("Stopped")).toBeTruthy();
  });

  it("disables start for an invalid tempo", async () => {
    const user = userEvent.setup();
    mockApi(() => ({}));
    render(<App />);
    await screen.findByText("stored note");
    const bpm = screen.getByLabelText("BPM");
    await user.clear(bpm);
    await user.type(bpm, "10");
    expect((screen.getByRole("button", { name: "Start" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("BPM must be between 30 and 300.")).toBeTruthy();
  });

  it("reports unavailable audio", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("AudioContext", class {
      constructor() {
        throw new Error("unsupported");
      }
    });
    mockApi(() => ({}));
    render(<App />);
    await screen.findByText("stored note");
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Audio could not be started");
    expect(screen.getByText("Stopped")).toBeTruthy();
  });

  it("closes the audio context on unmount", async () => {
    const user = userEvent.setup();
    mockApi(() => ({}));
    const { unmount } = render(<App />);
    await screen.findByText("stored note");
    await user.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(FakeAudioContext.instances).toHaveLength(1));
    unmount();
    expect(FakeAudioContext.instances[0]?.closed).toBe(true);
  });
});
