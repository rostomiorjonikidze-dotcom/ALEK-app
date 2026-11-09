import "server-only";
import {hasBlockingStripeSubscription} from "./payment-policy";
import {admin} from "../api/paypal/_shared";
import {getSubscription,tierFromPrice,verifiedPaidTier} from "./stripe-billing";

export async function reconcileStripeSubscription(id:string,expectedUser?:string){
  const sub=await getSubscription(id);
  const userId=sub.metadata?.user_id;
  if(!userId || !/^[0-9a-f-]{36}$/i.test(userId)) throw Error("Missing subscription owner");
  if(expectedUser && userId!==expectedUser) throw Error("Subscription owner mismatch");
  const price=sub.items?.data?.[0]?.price;
  const priceId=typeof price==="string"?price:price?.id||"";
  const knownTier=tierFromPrice(priceId);
  if(!knownTier) throw Error("Unknown subscription price");
  const db=admin();
  const {data:profile,error}=await db.from("profiles")
    .select("role,plan,paypal_subscription_status,stripe_subscription_id,stripe_subscription_status")
    .eq("id",userId).maybeSingle();
  if(error||!profile)throw Error("Customer profile unavailable");
  // A callback for a canceled older subscription must not overwrite a newer active subscription.
  if(profile.stripe_subscription_id && profile.stripe_subscription_id!==sub.id
     && hasBlockingStripeSubscription(profile.stripe_subscription_id,profile.stripe_subscription_status))
    return {status:"different_subscription",plan:profile.plan};
  const activeTier=verifiedPaidTier(sub);
  const paypalActive=String(profile.paypal_subscription_status||"").toUpperCase()==="ACTIVE";
  const plan=profile.role==="owner"?"business":activeTier|| (paypalActive?String(profile.plan||"free"):"free");
  const {error:writeError}=await db.from("profiles").update({
    stripe_subscription_id:sub.id,
    stripe_customer_id:typeof sub.customer==="string"?sub.customer:null,
    stripe_subscription_status:sub.status,
    stripe_price_id:priceId,
    stripe_updated_at:new Date().toISOString(),
    plan,
  }).eq("id",userId);
  if(writeError)throw Error("Unable to update subscription profile");
  return {status:sub.status,plan,active:Boolean(activeTier)};
}
