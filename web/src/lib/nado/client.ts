import { NADO_GATEWAY_REST } from "./config";

type GatewayResponse<T> = { status: "success"; data: T } | { status: "failure"; error?: string };

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
  const json = (await res.json()) as GatewayResponse<T>;
  if (json.status !== "success") {
    throw new Error("error" in json && json.error ? json.error : `Nado query "${type}" failed`);
  }
  return json.data;
}

export async function nadoExecute<T>(type: string, payload: unknown): Promise<T> {
  const res = await fetch(`${NADO_GATEWAY_REST}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [type]: payload }),
  });
  const json = (await res.json()) as GatewayResponse<T>;
  if (json.status !== "success") {
    throw new Error("error" in json && json.error ? json.error : `Nado execute "${type}" failed`);
  }
  return json.data;
}
