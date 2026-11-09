import {NextResponse} from "next/server";
import {userFrom} from "../../paypal/_shared";
import {stripeConfigured,stripeRequest} from "../../../lib/stripe-billing";
import {reconcileStripeSubscription} from "../../../lib/stripe-reconcile";
export const runtime="nodejs";
type CheckoutSession={id:string;status:string;payment_status:string;mode:string;subscription:string|null;client_reference_id:string|null};
export async function POST(request:Request){
  try{
    const user=await userFrom(request);
    if(!user)return NextResponse.json({error:"Connexion requise."},{status:401});
    if(!stripeConfigured())return NextResponse.json({error:"Service de paiement indisponible."},{status:503});
    const body=await request.json().catch(()=>({}));
    const id=typeof body?.sessionId==="string"?body.sessionId:"";
    if(!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(id))
      return NextResponse.json({error:"Session de paiement invalide."},{status:400});
    const requestedAt=new Date().toISOString();
    const checkout=await stripeRequest<CheckoutSession>("/v1/checkout/sessions/"+id);
    if(checkout.id!==id || checkout.client_reference_id!==user.id || checkout.mode!=="subscription")
      return NextResponse.json({error:"Cette session ne vous appartient pas."},{status:403});
    if(checkout.status!=="complete" || checkout.payment_status!=="paid" || !checkout.subscription)
      return NextResponse.json({status:"pending",message:"Paiement en attente de confirmation."});
    const result=await reconcileStripeSubscription(checkout.subscription,user.id,{requestedAt,checkoutSessionId:checkout.id});
    return NextResponse.json({
      status:result.status,active:result.active||false,
      plan:result.plan,
      message:result.active?"Abonnement activé avec succès.":"Le paiement est en cours de vérification.",
    });
  }catch{
    return NextResponse.json({error:"Vérification du paiement temporairement indisponible."},{status:503});
  }
}
