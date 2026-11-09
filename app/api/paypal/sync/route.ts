import {remainingPlan} from "../../../lib/payment-policy";
import {reconcilePaypalSubscription,verifyPaypalSubscription} from "../../../lib/billing-paypal";
import {NextResponse} from "next/server";
import {admin,userFrom} from "../_shared";
export const runtime="nodejs";

export async function POST(request:Request) {
  try {
    const user=await userFrom(request);
    if(!user)return NextResponse.json({error:"Connexion requise."},{status:401});
    const db=admin();
    const {data:profile,error}=await db.from("profiles")
      .select("role,paypal_subscription_id,stripe_subscription_status,stripe_price_id")
      .eq("id",user.id).maybeSingle();
    if(error||!profile)return NextResponse.json({error:"Profil indisponible."},{status:404});
    if(profile.role==="owner")return NextResponse.json({plan:"business",status:"OWNER"});
    const input=await request.json().catch(()=>({}));
    const requested=typeof input?.subscriptionId==="string"&&/^I-[A-Z0-9]{8,30}$/i.test(input.subscriptionId)
      ?input.subscriptionId:null;
    const id=requested||profile.paypal_subscription_id;
    const fallback=remainingPlan(profile,{pro:process.env.STRIPE_PRO_PRICE_ID,business:process.env.STRIPE_BUSINESS_PRICE_ID});
    if(!id)return NextResponse.json({plan:fallback,status:"NONE"});
    const observedAt=new Date().toISOString();
    const details=await verifyPaypalSubscription(id,user.id);
    if(requested&&profile.paypal_subscription_id&&profile.paypal_subscription_id!==requested){
      const existing=await verifyPaypalSubscription(profile.paypal_subscription_id,user.id);
      if(existing.status==="ACTIVE")return NextResponse.json({error:"Un abonnement actif existe déjà."},{status:409});
    }
    const result=await reconcilePaypalSubscription(user.id,details,{observedAt});
    if(result.reason==="different_active_subscription")return NextResponse.json({error:"Un abonnement actif existe déjà."},{status:409});
    if(result.reason==="out_of_order")return NextResponse.json({error:"Une mise à jour plus récente est déjà enregistrée."},{status:409});
    return NextResponse.json({plan:result.plan,status:result.status,active:result.active});
  }catch{return NextResponse.json({error:"Impossible de vérifier l’abonnement PayPal."},{status:503});}
}
