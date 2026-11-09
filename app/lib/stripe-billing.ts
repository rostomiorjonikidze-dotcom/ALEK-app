import "server-only";

export type Tier = "pro" | "business";
export const PLAN_CENTS: Record<Tier, number> = { pro: 1999, business: 4999 };
export const PRICE_KEY: Record<Tier, string> = { pro: "STRIPE_PRO_PRICE_ID", business: "STRIPE_BUSINESS_PRICE_ID" };
export const STRIPE_API_VERSION = "2025-02-24.acacia";
export const STRIPE_ORIGIN = "https://api.stripe.com";

export function stripeConfigured(): boolean {
  const sk=process.env.STRIPE_SECRET_KEY || "";
  const pk=process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  if (process.env.VERCEL_ENV==="production" && !sk.startsWith("sk_live_")) return false;
  return /^sk_(test|live)_/.test(sk)
    && /^pk_(test|live)_/.test(pk)
    && sk.slice(3,7) === pk.slice(3,7)
    && Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_"))
    && Boolean(process.env.STRIPE_PRO_PRICE_ID?.startsWith("price_"))
    && Boolean(process.env.STRIPE_BUSINESS_PRICE_ID?.startsWith("price_"));
}

export async function stripeRequest<T=Record<string, unknown>>(
  path: string,
  options: { method?: "GET"|"POST"; params?: URLSearchParams; idempotencyKey?: string }={}
): Promise<T> {
  const key=process.env.STRIPE_SECRET_KEY;
  if (!key || !/^sk_(test|live)_/.test(key)) throw Error("Stripe secret key missing");
  if (!/^\/v1\/[a-z_\/\-0-9]+$/i.test(path)) throw Error("Invalid Stripe API path");
  const response=await fetch(STRIPE_ORIGIN+path,{
    method:options.method||"GET",
    headers:{
      Authorization:"Bearer "+key,
      "Stripe-Version":STRIPE_API_VERSION,
      ...(options.params?{"Content-Type":"application/x-www-form-urlencoded"}:{}),
      ...(options.idempotencyKey?{"Idempotency-Key":options.idempotencyKey}:{}),
    },
    body:options.params?.toString(),
    cache:"no-store",
  });
  const value=await response.json().catch(()=>({}));
  if (!response.ok) throw Error("Stripe API "+response.status);
  return value as T;
}

export type StripePrice = {
  id:string; active:boolean; currency:string; unit_amount:number|null;
  recurring?:{interval:string;interval_count:number}|null;
};
export async function validatedPrice(tier:Tier):Promise<string> {
  const id=tier==="pro"?process.env.STRIPE_PRO_PRICE_ID:process.env.STRIPE_BUSINESS_PRICE_ID;
  if (!id || !/^price_[a-zA-Z0-9]+$/.test(id)) throw Error("Stripe price not configured");
  const price=await stripeRequest<StripePrice>("/v1/prices/"+id);
  if (!price.active || price.currency!=="eur" || price.unit_amount!==PLAN_CENTS[tier]
    || price.recurring?.interval!=="month" || Number(price.recurring?.interval_count||1)!==1)
    throw Error("Stripe price does not match ALEK published plan");
  return id;
}
export function tierFromPrice(id:string):Tier|null {
  if(id===process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if(id===process.env.STRIPE_BUSINESS_PRICE_ID) return "business";
  return null;
}
export type StripeSubscription = {
  id:string; status:string; customer:string; metadata?:{user_id?:string;plan?:string};
  items?:{data?:Array<{price?:{id?:string}|string}>};
  latest_invoice?:{paid?:boolean; status?:string}|string|null;
};
export async function getSubscription(id:string):Promise<StripeSubscription>{
  if (!/^sub_[a-zA-Z0-9]+$/.test(id)) throw Error("Invalid subscription ID");
  const params=new URLSearchParams([["expand[]","latest_invoice"]]);
  // GET includes query parameter rather than a body.
  const key=process.env.STRIPE_SECRET_KEY;
  if (!key) throw Error("Stripe unavailable");
  const response=await fetch(STRIPE_ORIGIN+"/v1/subscriptions/"+id+"?"+params.toString(),{
    headers:{Authorization:"Bearer "+key,"Stripe-Version":STRIPE_API_VERSION},cache:"no-store"
  });
  if(!response.ok) throw Error("Subscription verification failed");
  return response.json() as Promise<StripeSubscription>;
}
export function verifiedPaidTier(sub:StripeSubscription):Tier|null {
  if (sub.status!=="active") return null;
  if (typeof sub.latest_invoice!=="object" || !sub.latest_invoice?.paid) return null;
  const value=sub.items?.data?.[0]?.price;
  return tierFromPrice(typeof value==="string"?value:value?.id||"");
}
