import { afterEach, describe, expect, it, vi } from "vitest";
import { graphqlRequest, GraphqlRequestError, resolveGraphqlEndpoint } from "./graphqlClient";

function respondWith(body: string, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status }));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("graphqlClient", () => {
  it("sends a JSON POST without credentials", async () => {
    const fetchMock = respondWith('{"data":{"ok":true}}');
    await expect(graphqlRequest("{ ok }", { a: 1 })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/graphql");
    expect(init).toMatchObject({ method: "POST", credentials: "omit" });
    expect(JSON.parse(String(init?.body))).toEqual({ query: "{ ok }", variables: { a: 1 } });
  });

  it("uses the configured endpoint", () => {
    vi.stubEnv("VITE_GRAPHQL_URL", "https://api.example.test/graphql");
    expect(resolveGraphqlEndpoint()).toBe("https://api.example.test/graphql");
  });

  it("surfaces GraphQL errors", async () => {
    respondWith('{"data":null,"errors":[{"message":"bpm must be between 30 and 300"}]}');
    await expect(graphqlRequest("{ ok }")).rejects.toThrow("bpm must be between 30 and 300");
  });

  it("handles non-JSON responses", async () => {
    respondWith("<html>bad gateway</html>", 502);
    await expect(graphqlRequest("{ ok }")).rejects.toBeInstanceOf(GraphqlRequestError);
  });

  it("handles missing data", async () => {
    respondWith("{}");
    await expect(graphqlRequest("{ ok }")).rejects.toThrow("unexpected response");
  });

  it("reports network failures without leaking details", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("connect ECONNREFUSED 10.0.0.1"));
    await expect(graphqlRequest("{ ok }")).rejects.toThrow("The server could not be reached.");
  });

  it("propagates caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(graphqlRequest("{ ok }", {}, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
