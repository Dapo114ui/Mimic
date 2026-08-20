import { NADO_GATEWAY_REST } from "./config";

type GatewayResponse<T> = { status: "success"; data: T } | { status: "failure"; error?: string };

// Not every error path returns the `{status:"failure",...}` JSON envelope — a malformed/mistyped
// execute payload gets a plain-text 4xx body instead (e.g. "Failed to deserialize the JSON body
// into the target type: ..."), same wording as the indexer's own deserialize errors. Calling
// res.json() unconditionally on that throws an opaque "Unexpected token" SyntaxError that hides
// the actual, useful message — read as text first, then try to parse it as JSON.
async function parseGatewayResponse<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  let json: GatewayResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Nado ${label} failed (${res.status}): ${text || res.statusText}`);
  }
  if (json.status !== "success") {
    throw new Error("error" in json && json.error ? json.error : `Nado ${label} failed`);
  }
  return json.data;
}

// POST { type, ...params } to /query — confirmed against the SDK's own EngineBaseClient.query()
// (packages/engine-client/src/EngineBaseClient.ts), which uses this for every query including
// zero-param ones like `all_products` (body `{type:"all_products"}`). An earlier version of
// this function used GET with `?type=...`, which also happens to work live, but POST is what
// Nado's own client actually does, so params-taking queries (e.g. `subaccount_info`) follow it.
export async function nadoQuery<T>(type: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${NADO_GATEWAY_REST}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ type, ...params }),
  });
  return parseGatewayResponse<T>(res, `query "${type}"`);
}

export async function nadoExecute<T>(type: string, payload: unknown): Promise<T> {
  const res = await fetch(`${NADO_GATEWAY_REST}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [type]: payload }),
  });
  return parseGatewayResponse<T>(res, `execute "${type}"`);
}
