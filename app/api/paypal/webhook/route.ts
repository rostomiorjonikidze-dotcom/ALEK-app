import {NextResponse} from "next/server";
import {planAfterPaypalSync, remainingPlan} from "../../../lib/payment-policy";
import {admin, paypalBase, paypalToken, subscription} from "../_shared";

export const runtime="nodejs";
const MAX_BODY_BYTES=64*1024;
const SUBSCRIPTION_EVENTS=new Set([
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
]);

type PaypalEvent={id?:unknown;event_type?:unknown;resource?:Record<string,unknown>};

function subscriptionIdFor(event:PaypalEvent):string|null{
  const type=String(event.event_type||"");
  const resource=event.resource;
  const value=type.startsWith("BILLING.SUBSCRIPTION.")
    ?resource?.id
    :type.startsWith("PAYMENT.SALE.")?resource?.billing_agreement_id:null;
  return typeof value==="string"&&/^I-[A-Z0-9]{8,30}$/i.test(value)?value:null;
}

export async function POST(request:Request){
  const webhookId=process.env.PAYPAL_WEBHOOK_ID;
  if(!webhookId)return NextResponse.json({error:"Webhook PayPal non configuré."},{status:503});
  const length=Number(request.headers.get("content-length")||0);
  if(length>MAX_BODY_BYTES)return NextResponse.json({error:"Notification trop volumineuse."},{status:413});
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>MAX_BODY_BYTES)
    return NextResponse.json({error:"Notification trop volumineuse."},{status:413});

  let event:PaypalEvent;
  try{
    const parsed=JSON.parse(raw) as unknown;
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("Invalid event");
    event=parsed as PaypalEvent;
    if(typeof event.id!=="string"||typeof event.event_type!=="string"
      ||!event.resource||typeof event.resource!=="object"||Array.isArray(event.resource))throw Error("Invalid event");
  }catch{return NextResponse.json({error:"Notification PayPal invalide."},{status:400});}

  const headers=[
    ["auth_algo","paypal-auth-algo"],
    ["cert_url","paypal-cert-url"],
    ["transmission_id","paypal-transmission-id"],
    ["transmission_sig","paypal-transmission-sig"],
    ["transmission_time","paypal-transmission-time"],
  ] as const;
  const verification:Record<string,string|PaypalEvent>={webhook_id:webhookId,webhook_event:event};
  for(const [field,name] of headers){
    const value=request.headers.get(name);
    if(!value||value.length>1000)return NextResponse.json({error:"En-têtes de vérification PayPal manquants."},{status:400});
    verification[field]=value;
  }
  try{
    const token=await paypalToken();
    const response=await fetch(paypalBase()+"/v1/notifications/verify-webhook-signature",{
      method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify(verification),cache:"no-store",
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)return NextResponse.json({error:"Vérification PayPal indisponible."},{status:503});
    if(result?.verification_status!=="SUCCESS")return NextResponse.json({error:"Signature PayPal invalide."},{status:400});
  }catch{return NextResponse.json({error:"Vérification PayPal indisponible."},{status:503});}

  if(!SUBSCRIPTION_EVENTS.has(String(event.event_type)))return NextResponse.json({received:true,ignored:true});
  const id=subscriptionIdFor(event);
  if(!id)return NextResponse.json({error:"Abonnement absent de la notification PayPal."},{status:400});

  try{
    const db=admin();
    // A webhook may reconcile only the profile already linked to this exact provider ID.
    const {data:profile,error}=await db.from("profiles")
      .select("id,role,paypal_subscription_id,plan,stripe_subscription_status,stripe_price_id")
      .eq("paypal_subscription_id",id).maybeSingle();
    if(error)return NextResponse.json({error:"Profil de facturation indisponible."},{status:503});
    if(!profile)return NextResponse.json({received:true,ignored:true});
    if(profile.paypal_subscription_id!==id)return NextResponse.json({received:true,ignored:true});

    const current=await subscription(id);
    if(current.id!==id||current.custom_id!==profile.id)
      return NextResponse.json({error:"Titulaire de l’abonnement PayPal incohérent."},{status:503});
    if(profile.role==="owner")return NextResponse.json({received:true,ignored:true});
    const status=String(current.status||"").toUpperCase();
    if(!["ACTIVE","APPROVAL_PENDING","APPROVED","SUSPENDED","CANCELLED","EXPIRED"].includes(status))
      return NextResponse.json({error:"État de l’abonnement PayPal non reconnu."},{status:503});

    const env=process.env.PAYPAL_ENV?.toLowerCase()==="live"?"live":"sandbox";
    const {data:aliases,error:aliasesError}=await db.from("artisan_paypal_plan_overrides")
      .select("tier,paypal_plan_id").eq("environment",env);
    if(aliasesError)return NextResponse.json({error:"Configuration de facturation indisponible."},{status:503});
    const pro=process.env.PAYPAL_PRO_PLAN_ID,business=process.env.PAYPAL_BUSINESS_PLAN_ID;
    const tier=pro&&current.plan_id===pro?"pro":business&&current.plan_id===business?"business":
      aliases?.find((row:{tier:string;paypal_plan_id:string})=>row.paypal_plan_id===current.plan_id)?.tier||null;
    if(tier!=="pro"&&tier!=="business")
      return NextResponse.json({error:"Formule PayPal non reconnue."},{status:503});

    const fallback=remainingPlan(profile,{pro:process.env.STRIPE_PRO_PRICE_ID,business:process.env.STRIPE_BUSINESS_PRICE_ID});
    const plan=planAfterPaypalSync(status,tier,fallback);
    const {error:updateError}=await db.from("profiles").update({
      plan,paypal_subscription_status:status,subscription_updated_at:new Date().toISOString(),
    }).eq("id",profile.id).eq("paypal_subscription_id",id);
    if(updateError)return NextResponse.json({error:"Synchronisation PayPal différée."},{status:503});
    return NextResponse.json({received:true});
  }catch{return NextResponse.json({error:"Synchronisation PayPal différée."},{status:503});}
}
