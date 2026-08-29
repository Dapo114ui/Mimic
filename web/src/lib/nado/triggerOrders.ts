import { triggerExecute, triggerQuery } from "./triggerClient";

const X18 = 1e18;
const fromX18 = (v: string) => Number(BigInt(v)) / X18;

// Which oracle-price condition closes a position in profit vs. at a loss depends on which
// direction the position itself is (long/short), not just "is this TP or SL" — a long's take
// profit and a short's stop loss are both "price went up", just opposite intents.
export function triggerRequirementKey(
  positionSide: "buy" | "sell",
  kind: "tp" | "sl"
): "oracle_price_above" | "oracle_price_below" {
  if (positionSide === "buy") return kind === "tp" ? "oracle_price_above" : "oracle_price_below";
  return kind === "tp" ? "oracle_price_below" : "oracle_price_above";
}

// The execution price for a triggered order still has to be a real limit price the closing IOC
// order can cross with once the trigger fires — there's no live order book to check against
// ahead of time, so this applies the same fixed slippage cap past the trigger price itself that
// OrderForm's market-order logic applies past the live best bid/ask. Deliberately not shared
// code with that function: this one has no book to read (`priceIncrementX18` and a target price
// are all it has), so forcing a shared abstraction would just add an unused-book-level parameter
// to one side or the other.
const TRIGGER_EXECUTION_SLIPPAGE_BPS = 100n;

export function triggerExecutionPriceX18(
  triggerPriceX18: bigint,
  closingSide: "buy" | "sell",
  priceIncrementX18: bigint
): bigint {
  const increment = priceIncrementX18 > 0n ? priceIncrementX18 : 1n;
  const slippage = (triggerPriceX18 * TRIGGER_EXECUTION_SLIPPAGE_BPS) / 10_000n;
  const raw = closingSide === "buy" ? triggerPriceX18 + slippage : triggerPriceX18 - slippage;
  const ticks = raw / increment;
  let rounded = ticks * increment;
  if (closingSide === "buy" && rounded < raw) rounded += increment;
  if (rounded <= 0n) rounded = increment;
  return rounded;
}

type PlaceTriggerOrderParams = {
  productId: number;
  order: {
    sender: `0x${string}`;
    priceX18: bigint;
    amount: bigint;
    expiration: bigint;
    nonce: bigint;
    appendix: bigint;
  };
  requirementKey: "oracle_price_above" | "oracle_price_below";
  triggerPriceX18: bigint;
  signature: `0x${string}`;
};

type PlaceTriggerOrderResponse = { digest: string };

export async function placeTriggerOrder(params: PlaceTriggerOrderParams): Promise<PlaceTriggerOrderResponse> {
  return triggerExecute<PlaceTriggerOrderResponse>("place_order", {
    product_id: params.productId,
    order: {
      sender: params.order.sender,
      priceX18: params.order.priceX18.toString(),
      amount: params.order.amount.toString(),
      expiration: params.order.expiration.toString(),
      nonce: params.order.nonce.toString(),
      appendix: params.order.appendix.toString(),
    },
    trigger: {
      price_trigger: {
        price_requirement: { [params.requirementKey]: params.triggerPriceX18.toString() },
      },
    },
    signature: params.signature,
  });
}

export async function cancelTriggerOrders(params: {
  sender: `0x${string}`;
  productIds: number[];
  digests: string[];
  nonce: bigint;
  signature: `0x${string}`;
}): Promise<void> {
  await triggerExecute("cancel_orders", {
    tx: {
      sender: params.sender,
      productIds: params.productIds,
      digests: params.digests,
      nonce: params.nonce.toString(),
    },
    signature: params.signature,
  });
}

export type PendingTriggerOrder = {
  digest: string;
  productId: number;
  market: string;
  side: "Long" | "Short"; // the side of the CLOSING order itself, i.e. what it does once triggered
  size: number;
  triggerLabel: string;
  status: string;
  placedAt: string;
};

// The docs' own example response for this query shows the trigger criteria nested two
// different ways across two different pages of the same docs site (place-order's request body
// uses `price_trigger.price_requirement.oracle_price_above`; list-trigger-orders' example
// response abbreviates to a flat `price_above`) — exactly the kind of doc inconsistency this
// project has hit before and resolved by testing live, but there's no way to place a real
// trigger order without a real wallet to get a live response to test the parser against. Until
// one exists, this reads defensively: try the nested shape, fall back to the flat one, and
// degrade to "—" rather than throw if neither matches, so an unexpected shape shows an
// incomplete row instead of breaking the whole list.
type RawTriggerOrder = {
  order: {
    order: { amount: string };
    product_id: number;
    trigger?: {
      price_trigger?: { price_requirement?: Record<string, string> };
      price_above?: string;
      price_below?: string;
    };
    digest: string;
  };
  status: string;
  placed_at: number;
};

function describeTrigger(trigger: RawTriggerOrder["order"]["trigger"]): string {
  const nested = trigger?.price_trigger?.price_requirement;
  const entry = nested
    ? Object.entries(nested)[0]
    : trigger?.price_above
      ? (["price_above", trigger.price_above] as const)
      : trigger?.price_below
        ? (["price_below", trigger.price_below] as const)
        : undefined;
  if (!entry) return "—";
  const [key, value] = entry;
  const price = fromX18(value);
  const direction = key.includes("above") ? "≥" : "≤";
  return `Oracle ${direction} $${price.toLocaleString()}`;
}

export async function getPendingTriggerOrders(
  sender: `0x${string}`,
  recvTime: bigint,
  signature: `0x${string}`,
  symbolMap: Map<number, string>
): Promise<PendingTriggerOrder[]> {
  const data = await triggerQuery<{ orders: RawTriggerOrder[] }>("list_trigger_orders", {
    tx: { sender, recvTime: recvTime.toString() },
    signature,
    status_types: ["waiting_price", "waiting_dependency", "triggering"],
  });

  return data.orders.map((o) => {
    const amount = fromX18(o.order.order.amount);
    return {
      digest: o.order.digest,
      productId: o.order.product_id,
      market: symbolMap.get(o.order.product_id) ?? `Product #${o.order.product_id}`,
      side: amount >= 0 ? ("Long" as const) : ("Short" as const),
      size: Math.abs(amount),
      triggerLabel: describeTrigger(o.order.trigger),
      status: o.status,
      placedAt: new Date(o.placed_at).toISOString(),
    };
  });
}
