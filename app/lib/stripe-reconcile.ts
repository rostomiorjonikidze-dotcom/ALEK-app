import "server-only";
import {hasBlockingStripeSubscription,planAfterPaypalSync} from "./payment-policy";
import {admin,subscription as getPaypalSubscription} from "../api/paypal/_shared";
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
    .select("role,plan,paypal_subscription_id,paypal_subscription_status,stripe_subscription_id,stripe_subscription_status")
    .eq("id",userId).maybeSingle();
  if(error||!profile)throw Error("Customer profile unavailable");
  // A callback for a canceled older subscription must not overwrite a newer active subscription.
  if(profile.stripe_subscription_id && profile.stripe_subscription_id!==sub.id
     && hasBlockingStripeSubscription(profile.stripe_subscription_id,profile.stripe_subscription_status))
    return {status:"different_subscription",plan:profile.plan};
  const activeTier=verifiedPaidTier(sub);
  const paypalActive=String(profile.paypal_subscription_status||"").toUpperCase()==="ACTIVE";
  let paypalTier:"pro"|"business"|null=null;
  if(paypalActive&&profile.paypal_subscription_id){
    const paypalSub=await getPaypalSubscription(String(profile.paypal_subscription_id));
    if(paypalSub.id!==profile.paypal_subscription_id||paypalSub.custom_id!==userId)
      throw Error("PayPal subscription owner mismatch");
    if(String(paypalSub.status||"").toUpperCase()==="ACTIVE"){
      const env=process.env.PAYPAL_ENV?.toLowerCase()==="live"?"live":"sandbox";
      const {data:aliases,error:aliasError}=await db.from("artisan_paypal_plan_overrides")
        .select("tier,paypal_plan_id").eq("environment",env);
      if(aliasError)throw Error("PayPal plan aliases unavailable");
      const pro=process.env.PAYPAL_PRO_PLAN_ID,business=process.env.PAYPAL_BUSINESS_PLAN_ID;
      const matched=pro&&paypalSub.plan_id===pro?"pro":business&&paypalSub.plan_id===business?"business":
        aliases?.find((row:{tier:string;paypal_plan_id:string})=>row.paypal_plan_id===paypalSub.plan_id)?.tier||null;
      if(matched!=="pro"&&matched!=="business")throw Error("PayPal plan is not configured");
      paypalTier=matched;
    }
  }
  const plan=profile.role==="owner"?"business":planAfterPaypalSync(
    paypalActive&&paypalTier?"ACTIVE":"INACTIVE",paypalTier,activeTier||"free",
  );
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
