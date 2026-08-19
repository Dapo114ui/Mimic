import { NADO_GATEWAY_REST } from "./config";

type GatewayResponse<T> = { status: "success"; data: T } | { status: "failure"; error?: string };

// Only the no-params case is implemented (`?type=...`) — that's what's been verified live
// against the gateway. Nado's docs mention queries can also take a params object, but the
// exact wire format for that (query string vs. POST body) wasn't confirmed, so it's not
// guessed at here.
export async function nadoQuery<T>(type: string): Promise<T> {
  const res = await fetch(`${NADO_GATEWAY_REST}/query?type=${encodeURIComponent(type)}`, {
    headers: { Accept: "application/json" },
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
