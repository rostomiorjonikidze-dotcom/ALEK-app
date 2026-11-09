import "server-only";
import {admin} from "../api/paypal/_shared";
import {applyVerifiedBillingState,finishProviderCheckout} from "./billing-store";
import {getSubscription,tierFromPrice,verifiedSubscriptionPrice,verifiedPaidTier} from "./stripe-billing";

export type StripeObservation = {
  eventId?: string;
  eventCreated?: number;
  paymentEvent?: "none" | "sale_completed" | "refund" | "failed";
  requestedAt?: string;
};

export async function reconcileStripeSubscription(
  subscriptionId: string, expectedUser?: string, observation: StripeObservation = {},
) {
  const requestedAt = observation.requestedAt || new Date().toISOString();
  const sub = await getSubscription(subscriptionId);
  if (expectedUser && sub.metadata?.user_id !== expectedUser) throw Error("Subscription owner mismatch");
  const userId = expectedUser || sub.metadata?.user_id;
  if (!userId) throw Error("Subscription owner missing");
  const price = sub.items?.data?.[0]?.price;
  const priceId = typeof price === "string" ? price : price?.id || "";
  const tier = tierFromPrice(priceId);
  if (!tier) throw Error("Unknown subscription price");
  if (await verifiedSubscriptionPrice(tier) !== priceId) throw Error("Subscription price verification failed");

  const status = ["active", "trialing", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused"].includes(sub.status)
    ? sub.status
    : "unpaid";
  const paidTier = verifiedPaidTier(sub);
  const observedAt = observation.eventCreated
    ? new Date(observation.eventCreated * 1000).toISOString()
    : requestedAt;
  const paidThrough = typeof sub.current_period_end === "number"
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  const db = admin();
  const result = await applyVerifiedBillingState(db, {
    provider: "stripe",
    eventId: observation.eventId,
    observedAt,
    userId,
    subscriptionId: sub.id,
    status,
    tier,
    priceId,
    customerId: typeof sub.customer === "string" ? sub.customer : null,
    paymentVerified: Boolean(paidTier),
    paidThrough,
    paymentEvent: observation.paymentEvent,
  });
  if (result.applied && paidTier) await finishProviderCheckout(db, "stripe", sub.id, "complete");
  else if (result.applied && ["canceled", "incomplete_expired"].includes(status))
    await finishProviderCheckout(db, "stripe", sub.id, "failed");
  return {status: sub.status, plan: result.plan || "free", active: Boolean(result.applied && paidTier), reason: result.reason};
}
