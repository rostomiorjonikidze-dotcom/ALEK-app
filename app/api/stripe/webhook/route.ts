import {createHmac,timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {reconcileStripeSubscription} from "../../../lib/stripe-reconcile";
import {stripeRequest} from "../../../lib/stripe-billing";
import {admin} from "../../paypal/_shared";
import {finishProviderCheckout} from "../../../lib/billing-store";
import {readTextBody,RequestBodyError} from "../../../lib/request-body";
export const runtime="nodejs";

type StripeEvent={id:string;type:string;created:number;data:{object:Record<string,unknown>}};
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
  let raw:string;
  try{raw=await readTextBody(request,1_000_000);}catch(error){
    if(error instanceof RequestBodyError)return NextResponse.json({error:error.message},{status:error.status});
    return NextResponse.json({error:"Événement invalide."},{status:400});
  }
  if(!authentic(raw,signature,secret))return NextResponse.json({error:"Signature invalide."},{status:400});
  let event:StripeEvent;
  try{event=JSON.parse(raw.charCodeAt(0)===0xfeff?raw.slice(1):raw) as StripeEvent;}catch{
    return NextResponse.json({error:"Événement invalide."},{status:400});
  }
  if(!event || typeof event!=="object" || typeof event.id!=="string" || !event.id
    || typeof event.type!=="string" || !Number.isSafeInteger(event.created)
    || !event.data?.object)return NextResponse.json({error:"Événement incomplet."},{status:400});
  if(event.type==="checkout.session.expired"){
    const id=event.data.object.id;
    if(typeof id==="string"){
      try{await finishProviderCheckout(admin(),"stripe",id,"failed");}
      catch{return NextResponse.json({error:"Synchronisation différée."},{status:503});}
    }
    return NextResponse.json({received:true});
  }
  let subscriptionId:string|null=null;
  let checkoutSessionId:string|null=null;
  let paymentEvent:"none"|"sale_completed"|"refund"|"failed"="none";
  if(event.type==="checkout.session.completed" || event.type==="checkout.session.async_payment_succeeded"){
    const obj=event.data.object;
    if(obj.mode==="subscription" && typeof obj.subscription==="string"){
      subscriptionId=obj.subscription;
      if(typeof obj.id==="string")checkoutSessionId=obj.id;
    }
  }else if(event.type==="customer.subscription.updated" || event.type==="customer.subscription.deleted"
    || event.type==="customer.subscription.created" || event.type==="customer.subscription.paused"
    || event.type==="customer.subscription.resumed"){
    if(typeof event.data.object.id==="string")subscriptionId=event.data.object.id;
  }else if(event.type==="invoice.paid" || event.type==="invoice.payment_failed"){
    paymentEvent=event.type==="invoice.paid"?"sale_completed":"failed";
    const parent=event.data.object.parent as {subscription_details?:{subscription?:string};subscription?:string}|undefined;
    const legacy=event.data.object.subscription;
    subscriptionId=(typeof legacy==="string"?legacy:
      parent?.subscription_details?.subscription||parent?.subscription)||null;
  }else if(event.type==="charge.refunded" || event.type==="charge.dispute.created"){
    paymentEvent="refund";
    const invoice=event.data.object.invoice;
    const invoiceId=typeof invoice==="string"?invoice:
      invoice&&typeof invoice==="object"&&typeof (invoice as {id?:unknown}).id==="string"?(invoice as {id:string}).id:null;
    if(invoiceId&&/^in_[A-Za-z0-9]+$/.test(invoiceId)){
      const details=await stripeRequest<{subscription?:string|null;parent?:{subscription_details?:{subscription?:string}}}>("/v1/invoices/"+invoiceId);
      subscriptionId=details.parent?.subscription_details?.subscription||details.subscription||null;
    }else if(typeof event.data.object.payment_intent==="string"){
      const params=new URLSearchParams({payment_intent:event.data.object.payment_intent,limit:"1"});
      const details=await stripeRequest<{data?:Array<{subscription?:string|null;parent?:{subscription_details?:{subscription?:string}}}>}>("/v1/invoices",{params});
      const invoice=details.data?.[0];
      subscriptionId=invoice?.parent?.subscription_details?.subscription||invoice?.subscription||null;
    }
  }
  if(!subscriptionId)return NextResponse.json({received:true});
  try{
    await reconcileStripeSubscription(subscriptionId,undefined,{
      eventId:event.id,eventCreated:event.created,paymentEvent,checkoutSessionId:checkoutSessionId||undefined,
    });
    return NextResponse.json({received:true});
  }catch{
    // Stripe retries delivery on 5xx. Never grant access without verification.
    console.error("Stripe webhook reconciliation failed");
    return NextResponse.json({error:"Synchronisation différée."},{status:503});
  }
}
