import { NADO_TRIGGER_REST } from "./config";

// Same wire format as the gateway (client.ts) — {status:"success"|"failure",...} envelopes,
// POST {type,...params} to /query and POST {[type]:payload} to /execute — confirmed against
// docs.nado.xyz's trigger service pages. Kept as its own file rather than folded into
// client.ts because it's a genuinely separate deployment (trigger.prod.nado.xyz, not
// gateway.prod.nado.xyz) with its own service-specific request/response shapes beyond the
// shared envelope, matching this codebase's existing one-file-per-backend-service convention
// (client.ts for the gateway, indexer.ts for the archive service).
type TriggerResponse<T> = { status: "success"; data: T } | { status: "failure"; error?: string };

async function parseTriggerResponse<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  let json: TriggerResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Nado trigger ${label} failed (${res.status}): ${text || res.statusText}`);
  }
  if (json.status !== "success") {
    throw new Error("error" in json && json.error ? json.error : `Nado trigger ${label} failed`);
  }
  return json.data;
}

export async function triggerQuery<T>(type: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${NADO_TRIGGER_REST}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ type, ...params }),
  });
  return parseTriggerResponse<T>(res, `query "${type}"`);
}

export async function triggerExecute<T>(type: string, payload: unknown): Promise<T> {
  const res = await fetch(`${NADO_TRIGGER_REST}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [type]: payload }),
  });
  return parseTriggerResponse<T>(res, `execute "${type}"`);
}
