import { NextResponse } from "next/server";
import { admin, paypalBase, paypalToken, userFrom } from "../_shared";
export const runtime="nodejs";
export async function POST(request:Request) {
 try {
  const user=await userFrom(request);
  if(!user) return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json();
  const plan=body?.plan==="pro"?"pro":body?.plan==="business"?"business":null;
  if(!plan) return NextResponse.json({error:"Invalid plan"},{status:400});
  const planId=plan==="pro"?process.env.PAYPAL_PRO_PLAN_ID:process.env.PAYPAL_BUSINESS_PLAN_ID;
  if(!planId) return NextResponse.json({error:"Plan unavailable"},{status:503});
  // Never send a buyer to PayPal when the configured plan charges a different amount.
  const accessToken=await paypalToken();
  const planResponse=await fetch(paypalBase()+"/v1/billing/plans/"+encodeURIComponent(planId),{headers:{Authorization:"Bearer "+accessToken},cache:"no-store"});
  if(!planResponse.ok) return NextResponse.json({error:"Impossible de vérifier le tarif PayPal. Réessayez plus tard."},{status:503});
  const paypalPlan=await planResponse.json();
  const expected=plan==="pro"?"19.99":"49.99";
  const cycles=Array.isArray(paypalPlan.billing_cycles)?paypalPlan.billing_cycles:[];
  const regular=cycles.find((cycle:{tenure_type?:string})=>cycle.tenure_type==="REGULAR");
  const fixed=regular?.pricing_scheme?.fixed_price;
  const monthly=regular?.frequency?.interval_unit==="MONTH" && Number(regular?.frequency?.interval_count)===1;
  const actual=Number(fixed?.value);
  if(paypalPlan.status!=="ACTIVE" || !monthly || fixed?.currency_code!=="EUR" || !Number.isFinite(actual) || Math.abs(actual-Number(expected))>0.001) return NextResponse.json({error:"Le tarif PayPal de cette formule n’est pas encore synchronisé avec le prix affiché. Aucun paiement n’a été lancé."},{status:503});
  const {data:profile}=await admin().from("profiles").select("role,paypal_subscription_id,paypal_subscription_status").eq("id",user.id).maybeSingle();
  if(profile?.role==="owner") return NextResponse.json({error:"Owner already has full access"},{status:409});
  if(profile?.paypal_subscription_id && profile?.paypal_subscription_status==="ACTIVE") return NextResponse.json({error:"Manage your existing subscription before creating another"},{status:409});
  const token=accessToken;
  const response=await fetch(paypalBase()+"/v1/billing/subscriptions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","PayPal-Request-Id":crypto.randomUUID()},body:JSON.stringify({plan_id:planId,custom_id:user.id,application_context:{brand_name:"ALEK",user_action:"SUBSCRIBE_NOW",return_url:"https://app.alek.best/pricing?paypal=success",cancel_url:"https://app.alek.best/pricing?paypal=cancel"}}),cache:"no-store"});
  const data=await response.json();
  const approval=data?.links?.find((link:{rel:string;href:string})=>link.rel==="approve")?.href;
  if(!response.ok || !approval || !approval.startsWith("https://www.paypal.com/") && !approval.startsWith("https://www.sandbox.paypal.com/")) return NextResponse.json({error:"Unable to start PayPal subscription"},{status:502});
  return NextResponse.json({url:approval});
 } catch { return NextResponse.json({error:"Payment service unavailable"},{status:503}); }
}
