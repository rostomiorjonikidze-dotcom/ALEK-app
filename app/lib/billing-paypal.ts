import "server-only";
import {admin,paypalBase,paypalToken,subscription} from "../api/paypal/_shared";
import {applyVerifiedBillingState,finishProviderCheckout} from "./billing-store";
import type {PaidTier} from "./payment-policy";

type PaypalDetails = {
  id?: string;
  custom_id?: string;
  status?: string;
  plan_id?: string;
  billing_info?: {
    last_payment?: {amount?: {currency_code?: string; value?: string}; time?: string};
    next_billing_time?: string;
  };
};

const planPrice: Record<PaidTier, number> = {pro: 19.99, business: 49.99};

export async function reconcilePaypalSubscription(
  userId: string,
  details: PaypalDetails,
  observation: {
    eventId?: string;
    observedAt: string;
    paymentEvent?: "none" | "sale_completed" | "refund" | "failed";
  },
) {
  if (details.custom_id !== userId || typeof details.id !== "string" || typeof details.plan_id !== "string")
    throw Error("PayPal subscription owner mismatch");
  const db = admin();
  const environment = process.env.PAYPAL_ENV?.toLowerCase() === "live" ? "live" : "sandbox";
  const {data:aliases, error} = await db.from("artisan_paypal_plan_overrides")
    .select("tier,paypal_plan_id").eq("environment", environment);
  if (error) throw Error("PayPal plan aliases unavailable");
  const pro = process.env.PAYPAL_PRO_PLAN_ID;
  const business = process.env.PAYPAL_BUSINESS_PLAN_ID;
  const matched = pro && details.plan_id === pro ? "pro" : business && details.plan_id === business ? "business" :
    aliases?.find((row: {tier: string; paypal_plan_id: string}) => row.paypal_plan_id === details.plan_id)?.tier;
  const tier: PaidTier | null = matched === "pro" || matched === "business" ? matched : null;
  if (!tier) throw Error("PayPal plan is not configured");
  const token = await paypalToken();
  const planResponse = await fetch(paypalBase() + "/v1/billing/plans/" + encodeURIComponent(details.plan_id), {
    headers: {Authorization: "Bearer " + token}, cache: "no-store",
  });
  if (!planResponse.ok) throw Error("PayPal plan verification failed");
  const plan = await planResponse.json() as {
    status?: string;
    billing_cycles?: Array<{tenure_type?: string;frequency?: {interval_unit?: string;interval_count?: number};
      pricing_scheme?: {fixed_price?: {currency_code?: string;value?: string}}}>;
  };
  const regular = plan.billing_cycles?.find(cycle => cycle.tenure_type === "REGULAR");
  const fixed = regular?.pricing_scheme?.fixed_price;
  if (plan.status !== "ACTIVE" || regular?.frequency?.interval_unit !== "MONTH"
    || Number(regular.frequency.interval_count || 1) !== 1 || fixed?.currency_code !== "EUR"
    || Math.abs(Number(fixed.value) - planPrice[tier]) >= 0.001)
    throw Error("PayPal plan price does not match ALEK tier");
  const status = String(details.status || "").toUpperCase();
  if (!["ACTIVE", "APPROVAL_PENDING", "APPROVED", "SUSPENDED", "CANCELLED", "EXPIRED"].includes(status))
    throw Error("Unknown PayPal subscription status");
  const lastPayment = details.billing_info?.last_payment;
  const paidAt = Date.parse(lastPayment?.time || "");
  const paidValue = Number(lastPayment?.amount?.value);
  const verifiedPayment = lastPayment?.amount?.currency_code === "EUR"
    && Number.isFinite(paidValue) && Math.abs(paidValue - planPrice[tier]) < 0.001
    && Number.isFinite(paidAt) && paidAt <= Date.now();
  const paidThrough = details.billing_info?.next_billing_time;
  const result = await applyVerifiedBillingState(db, {
    provider: "paypal",
    eventId: observation.eventId,
    observedAt: observation.observedAt,
    userId,
    subscriptionId: details.id,
    status,
    tier,
    paymentVerified: verifiedPayment,
    paidThrough: paidThrough && Number.isFinite(Date.parse(paidThrough)) ? paidThrough : null,
    paymentEvent: observation.paymentEvent,
  });
  if (result.applied && result.payment_verified) await finishProviderCheckout(db, "paypal", details.id, "complete");
  else if (result.applied && ["CANCELLED", "EXPIRED"].includes(status))
    await finishProviderCheckout(db, "paypal", details.id, "failed");
  return {status, plan: result.plan || "free", active: Boolean(result.applied && result.payment_verified), reason: result.reason};
}

export async function verifyPaypalSubscription(id: string, userId: string): Promise<PaypalDetails> {
  const details = await subscription(id) as PaypalDetails;
  if (details.id !== id || details.custom_id !== userId) throw Error("PayPal subscription owner mismatch");
  return details;
}
