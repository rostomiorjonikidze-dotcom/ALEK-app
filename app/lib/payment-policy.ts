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
