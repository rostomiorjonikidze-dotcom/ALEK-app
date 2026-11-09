import {createHmac,timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {reconcileStripeSubscription} from "../../../lib/stripe-reconcile";
export const runtime="nodejs";

type StripeEvent={id:string;type:string;data:{object:Record<string,unknown>}};
function authentic(payload:string,signature:string,secret:string):boolean{
  const parts=signature.split(",").map(p=>p.trim());
  const time=parts.find(p=>p.startsWith("t="))?.slice(2);
  const values=parts.filter(p=>p.startsWith("v1=")).map(p=>p.slice(3));
  if(!time || !/^\d+$/.test(time) || !values.length)return false;
  const sentAt=Number(time);
  if(!Number.isSafeInteger(sentAt) || Math.abs(Date.now()/1000-sentAt)>300)return false;
  const expected=createHmac("sha256",secret).update(time+"."+payload).digest();
  return values.some(value=>{
    if(!/^[a-f0-9]{64}$/i.test(value))return false;
    return timingSafeEqual(Buffer.from(value,"hex"),expected);
  });
}

export async function POST(request:Request){
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret)return NextResponse.json({error:"Webhook non configuré."},{status:503});
  const signature=request.headers.get("stripe-signature")||"";
  const raw=await request.text();
  if(raw.length>1_000_000)return NextResponse.json({error:"Événement trop volumineux."},{status:413});
  if(!authentic(raw,signature,secret))return NextResponse.json({error:"Signature invalide."},{status:400});
  let event:StripeEvent;
  try{event=JSON.parse(raw) as StripeEvent;}catch{
    return NextResponse.json({error:"Événement invalide."},{status:400});
  }
  if(!event || typeof event!=="object" || !event.type || !event.data?.object)return NextResponse.json({error:"Événement incomplet."},{status:400});
  let subscriptionId:string|null=null;
  if(event.type==="checkout.session.completed" || event.type==="checkout.session.async_payment_succeeded"){
    const obj=event.data.object;
    if(obj.mode==="subscription" && typeof obj.subscription==="string")subscriptionId=obj.subscription;
  }else if(event.type==="customer.subscription.updated" || event.type==="customer.subscription.deleted"
    || event.type==="customer.subscription.created" || event.type==="customer.subscription.paused"
    || event.type==="customer.subscription.resumed"){
    if(typeof event.data.object.id==="string")subscriptionId=event.data.object.id;
  }else if(event.type==="invoice.paid" || event.type==="invoice.payment_failed"){
    const parent=event.data.object.parent as {subscription_details?:{subscription?:string};subscription?:string}|undefined;
    const legacy=event.data.object.subscription;
    subscriptionId=(typeof legacy==="string"?legacy:
      parent?.subscription_details?.subscription||parent?.subscription)||null;
  }
  if(!subscriptionId)return NextResponse.json({received:true});
  try{
    await reconcileStripeSubscription(subscriptionId);
    return NextResponse.json({received:true});
  }catch{
    // Stripe retries delivery on 5xx. Never grant access without verification.
    console.error("Stripe webhook reconciliation failed");
    return NextResponse.json({error:"Synchronisation différée."},{status:503});
  }
}
