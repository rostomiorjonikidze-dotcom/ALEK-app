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
  const {data:profile}=await admin().from("profiles").select("role,paypal_subscription_id,paypal_subscription_status").eq("id",user.id).maybeSingle();
  if(profile?.role==="owner") return NextResponse.json({error:"Owner already has full access"},{status:409});
  if(profile?.paypal_subscription_id && profile?.paypal_subscription_status==="ACTIVE") return NextResponse.json({error:"Manage your existing subscription before creating another"},{status:409});
  const token=await paypalToken();
  const response=await fetch(paypalBase()+"/v1/billing/subscriptions",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","PayPal-Request-Id":crypto.randomUUID()},body:JSON.stringify({plan_id:planId,custom_id:user.id,application_context:{brand_name:"ALEK",user_action:"SUBSCRIBE_NOW",return_url:"https://app.alek.best/pricing?paypal=success",cancel_url:"https://app.alek.best/pricing?paypal=cancel"}}),cache:"no-store"});
  const data=await response.json();
  const approval=data?.links?.find((link:{rel:string;href:string})=>link.rel==="approve")?.href;
  if(!response.ok || !approval || !approval.startsWith("https://www.paypal.com/") && !approval.startsWith("https://www.sandbox.paypal.com/")) return NextResponse.json({error:"Unable to start PayPal subscription"},{status:502});
  return NextResponse.json({url:approval});
 } catch { return NextResponse.json({error:"Payment service unavailable"},{status:503}); }
}
