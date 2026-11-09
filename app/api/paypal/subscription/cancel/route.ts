import {billingIdempotencyKey} from "../../../../lib/billing-idempotency";
import {reconcilePaypalSubscription,verifyPaypalSubscription} from "../../../../lib/billing-paypal";
import {NextResponse} from "next/server";
import {admin,paypalBase,paypalToken,userFrom} from "../../_shared";
export const runtime="nodejs";

export async function POST(request:Request){
  try{
    const user=await userFrom(request);
    if(!user)return NextResponse.json({error:"Connexion requise."},{status:401});
    const db=admin();
    const {data:profile,error}=await db.from("profiles").select("paypal_subscription_id")
      .eq("id",user.id).maybeSingle();
    if(error)return NextResponse.json({error:"Impossible de vérifier le compte."},{status:503});
    const id=profile?.paypal_subscription_id;
    if(!id)return NextResponse.json({error:"Aucun abonnement PayPal lié à ce compte. Consultez vos paiements automatiques PayPal ou contactez le support."},{status:404});
    const current=await verifyPaypalSubscription(id,user.id);
    if(current.status==="CANCELLED"||current.status==="EXPIRED"){
      const result=await reconcilePaypalSubscription(user.id,current,{observedAt:new Date().toISOString()});
      return NextResponse.json({status:current.status,plan:result.plan,message:"Abonnement déjà résilié. L’accès payé est conservé jusqu’à la date de fin confirmée par PayPal."});
    }
    const status=String(current.status||"").toUpperCase();
    const nextBillingTime=current.billing_info?.next_billing_time;
    if(status==="ACTIVE"||nextBillingTime){
      const paidThrough=Date.parse(nextBillingTime||"");
      if(status!=="ACTIVE"||!Number.isFinite(paidThrough)||paidThrough<=Date.now())
        return NextResponse.json({error:"Impossible de vérifier la période déjà payée. La résiliation n’a pas été envoyée; contactez le support."},{status:503});
      const beforeCancel=await reconcilePaypalSubscription(user.id,current,{observedAt:new Date().toISOString()});
      if(!beforeCancel.active)
        return NextResponse.json({error:"Impossible de confirmer le paiement et sa date de fin. La résiliation n’a pas été envoyée; contactez le support."},{status:503});
    }
    const token=await paypalToken();
    const response=await fetch(paypalBase()+"/v1/billing/subscriptions/"+encodeURIComponent(id)+"/cancel",{
      method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",
        "PayPal-Request-Id":billingIdempotencyKey("paypal","cancel",id)},
      body:JSON.stringify({reason:"Résiliation demandée par le titulaire depuis ALEK"}),cache:"no-store",
    });
    if(!response.ok)return NextResponse.json({error:"PayPal n’a pas confirmé la résiliation. Réessayez ou contactez le support."},{status:502});
    const observedAt=new Date().toISOString();
    const verified=await verifyPaypalSubscription(id,user.id);
    if(verified.status!=="CANCELLED")return NextResponse.json({status:verified.status,message:"Demande envoyée. Vérifiez votre compte PayPal et contactez le support si nécessaire."});
    const result=await reconcilePaypalSubscription(user.id,verified,{observedAt});
    return NextResponse.json({status:"CANCELLED",plan:result.plan,
      message:"Résiliation confirmée par PayPal. Aucun nouveau renouvellement n’aura lieu; l’accès payé est conservé jusqu’à la date de fin confirmée par PayPal."});
  }catch{return NextResponse.json({error:"Service PayPal indisponible. Vous pouvez aussi résilier depuis votre compte PayPal."},{status:503});}
}
