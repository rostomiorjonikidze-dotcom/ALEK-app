import "server-only";
import type {PaidTier} from "./payment-policy";
import type {BillingProvider} from "./billing-idempotency";

type BillingDb = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{data: unknown; error: unknown}>;
};

export type CheckoutClaim = {
  decision: "create" | "reuse" | "busy" | "conflict" | "manual_review";
  attempt_id?: string;
  fence?: number;
  idempotency_key?: string;
  provider_resource_id?: string | null;
  approval_url?: string | null;
};

export async function claimCheckout(
  db: BillingDb, userId: string, provider: BillingProvider, tier: PaidTier,
): Promise<CheckoutClaim> {
  const {data, error} = await db.rpc("billing_claim_checkout", {
    p_user_id: userId, p_provider: provider, p_tier: tier,
  });
  if (error || !data || typeof data !== "object") throw Error("Billing coordination unavailable");
  const claim = data as CheckoutClaim;
  if (!["create", "reuse", "busy", "conflict", "manual_review"].includes(claim.decision))
    throw Error("Invalid billing coordination response");
  return claim;
}

export async function finishCheckout(
  db: BillingDb, attemptId: string, fence: number, status: "unknown" | "pending" | "complete" | "failed",
  providerResourceId?: string, approvalUrl?: string,
): Promise<void> {
  const {data, error} = await db.rpc("billing_finish_checkout", {
    p_attempt_id: attemptId, p_fence: fence, p_status: status,
    p_provider_resource_id: providerResourceId || null, p_approval_url: approvalUrl || null,
  });
  if (error || data !== true) throw Error("Billing checkout fence rejected the update");
}

export async function finishProviderCheckout(
  db: BillingDb, provider: BillingProvider, providerResourceId: string, status: "complete" | "failed",
): Promise<void> {
  const {error} = await db.rpc("billing_finish_provider_checkout", {
    p_provider: provider, p_provider_resource_id: providerResourceId, p_status: status,
  });
  if (error) throw Error("Billing checkout finalization failed");
}

export type VerifiedBillingState = {
  provider: BillingProvider;
  eventId?: string | null;
  observedAt: string;
  userId: string;
  subscriptionId: string;
  status: string;
  tier: PaidTier | null;
  priceId?: string | null;
  customerId?: string | null;
  paymentVerified: boolean;
  paidThrough?: string | null;
  paymentEvent?: "none" | "sale_completed" | "refund" | "failed";
};

export async function applyVerifiedBillingState(db: BillingDb, state: VerifiedBillingState): Promise<{
  applied: boolean; reason?: string; plan?: string; payment_verified?: boolean;
}> {
  const {data, error} = await db.rpc("billing_apply_verified_state", {
    p_provider: state.provider,
    p_event_id: state.eventId || null,
    p_observed_at: state.observedAt,
    p_user_id: state.userId,
    p_subscription_id: state.subscriptionId,
    p_status: state.status,
    p_tier: state.tier,
    p_price_id: state.priceId || null,
    p_customer_id: state.customerId || null,
    p_payment_verified: state.paymentVerified,
    p_paid_through: state.paidThrough || null,
    p_payment_event: state.paymentEvent || "none",
  });
  if (error || !data || typeof data !== "object") throw Error("Billing state update unavailable");
  return data as {applied: boolean; reason?: string; plan?: string; payment_verified?: boolean};
}
