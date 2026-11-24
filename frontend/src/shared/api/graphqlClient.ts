const REQUEST_TIMEOUT_MS = 10_000;

export class GraphqlRequestError extends Error {
  override readonly name = "GraphqlRequestError";
}

interface GraphqlPayload<TData> {
  data?: TData | null;
  errors?: { message?: unknown }[];
}

export function resolveGraphqlEndpoint(): string {
  return import.meta.env.VITE_GRAPHQL_URL || "/graphql";
}

export async function graphqlRequest<TData>(
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<TData> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(resolveGraphqlEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ query, variables }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (cause) {
    if (signal?.aborted) {
      throw cause;
    }
    throw new GraphqlRequestError("The server could not be reached.");
  }

  const payload = await readPayload<TData>(response);
  const message = payload?.errors?.[0]?.message;
  if (typeof message === "string" && message) {
    throw new GraphqlRequestError(message);
  }
  if (!response.ok || payload?.data === undefined || payload.data === null) {
    throw new GraphqlRequestError("The server returned an unexpected response.");
  }
  return payload.data;
}

async function readPayload<TData>(response: Response): Promise<GraphqlPayload<TData> | null> {
  try {
    return (await response.json()) as GraphqlPayload<TData>;
  } catch {
    return null;
  }
}
