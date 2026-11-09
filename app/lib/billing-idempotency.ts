import {createHash} from "node:crypto";

export type BillingProvider = "stripe" | "paypal";
export type BillingOperation = "checkout" | "cancel";

export function billingIdempotencyKey(
  provider: BillingProvider,
  operation: BillingOperation,
  identity: string,
): string {
  if (!identity || identity.length > 255) throw Error("Invalid billing idempotency identity");
  const digest = createHash("sha256")
    .update(`${provider}:${operation}:${identity}`)
    .digest("hex")
    .slice(0, 32);
  // PayPal limits PayPal-Request-Id to 38 characters.
  return `alek-${digest}`;
}
