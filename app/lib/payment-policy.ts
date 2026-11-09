export type PaidTier = "pro" | "business";

export function hasBlockingStripeSubscription(id: unknown, status: unknown): boolean {
  return Boolean(id) && ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(String(status || ""));
}

export function remainingPlan(profile: {
  role?: string | null;
  stripe_subscription_status?: string | null;
  stripe_price_id?: string | null;
}, prices: { pro?: string; business?: string }): "free" | PaidTier {
  if (profile.role === "owner") return "business";
  if (profile.stripe_subscription_status !== "active") return "free";
  if (prices.business && profile.stripe_price_id === prices.business) return "business";
  if (prices.pro && profile.stripe_price_id === prices.pro) return "pro";
  return "free";
}

export function planAfterPaypalSync(
  status: string,
  paypalTier: PaidTier | null,
  otherProviderPlan: "free" | PaidTier,
): "free" | PaidTier {
  const activePaypalTier:"free"|PaidTier=status.toUpperCase()==="ACTIVE"?(paypalTier||"free"):"free";
  const rank={free:0,pro:1,business:2};
  return rank[activePaypalTier]>rank[otherProviderPlan]?activePaypalTier:otherProviderPlan;
}
