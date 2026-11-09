import {hasBlockingStripeSubscription} from "../../../lib/payment-policy";
import {claimCheckout,finishCheckout,finishProviderCheckout} from "../../../lib/billing-store";
import {NextResponse} from "next/server";
import {admin,userFrom} from "../../paypal/_shared";
import {stripeConfigured,stripeRequest,validatedPrice,PLAN_CENTS,type Tier} from "../../../lib/stripe-billing";

export const runtime="nodejs";
export async function POST(request:Request){
  try {
    const user=await userFrom(request);
    if(!user) return NextResponse.json({error:"Connexion requise."},{status:401});
    if(!stripeConfigured()) return NextResponse.json({error:"Paiement par carte en cours d'activation. Aucun paiement n'a été lancé."},{status:503});
    const input=await request.json().catch(()=>({}));
    const tier:Tier|null=input?.plan==="pro"?"pro":input?.plan==="business"?"business":null;
    if(!tier) return NextResponse.json({error:"Formule invalide."},{status:400});
    const db=admin();
    const {data:profile,error}=await db.from("profiles")
      .select("role,plan,paypal_subscription_id,paypal_subscription_status,stripe_subscription_id,stripe_subscription_status,stripe_customer_id")
      .eq("id",user.id).maybeSingle();
    if(error||!profile)return NextResponse.json({error:"Profil indisponible."},{status:503});
    if(profile.role==="owner")return NextResponse.json({error:"Le compte administrateur dispose déjà de l'accès complet."},{status:409});
    if(profile.paypal_subscription_id && ["ACTIVE","APPROVAL_PENDING","APPROVED","SUSPENDED"].includes(String(profile.paypal_subscription_status||"").toUpperCase()))
      return NextResponse.json({error:"Un abonnement PayPal existe déjà. Résiliez-le avant de souscrire par carte afin d'éviter un double prélèvement."},{status:409});
    if(hasBlockingStripeSubscription(profile.stripe_subscription_id,profile.stripe_subscription_status))
      return NextResponse.json({error:"Un abonnement par carte existe déjà ou nécessite une mise à jour. Contactez le support pour éviter un double abonnement."},{status:409});
    const priceId=await validatedPrice(tier);
    const params=new URLSearchParams();
    params.set("ui_mode","embedded");
    params.set("mode","subscription");
    params.set("locale","fr");
    params.set("payment_method_types[0]","card");
    params.set("redirect_on_completion","never");
    params.set("line_items[0][price]",priceId);
    params.set("line_items[0][quantity]","1");
    params.set("client_reference_id",user.id);
    params.set("subscription_data[metadata][user_id]",user.id);
    params.set("subscription_data[metadata][plan]",tier);
    params.set("metadata[user_id]",user.id);
    params.set("metadata[plan]",tier);
    params.set("billing_address_collection","required");
    if(profile.stripe_customer_id && /^cus_[A-Za-z0-9]+$/.test(profile.stripe_customer_id)){
      params.set("customer",profile.stripe_customer_id);
    }else if(user.email){
      params.set("customer_email",user.email);
    }
    const claim=await claimCheckout(db,user.id,"stripe",tier);
    if(claim.decision==="busy")return NextResponse.json({error:"Une demande de paiement est déjà en cours. Réessayez dans un instant."},{status:409});
    if(claim.decision==="entitled")return NextResponse.json({error:"Un accès payant est déjà actif. Aucun nouvel abonnement n’a été créé."},{status:409});
    if(claim.decision==="conflict")return NextResponse.json({error:"Une autre demande d’abonnement est en attente. Terminez-la ou contactez le support avant de réessayer."},{status:409});
    if(claim.decision==="manual_review")return NextResponse.json({error:"Une demande précédente doit être vérifiée par le support avant toute nouvelle tentative. Aucun autre paiement n’a été lancé."},{status:409});
    if(claim.decision==="reuse"&&claim.provider_resource_id){
      const existing=await stripeRequest<{id?:string;client_secret?:string;mode?:string;client_reference_id?:string;status?:string}>(
        "/v1/checkout/sessions/"+claim.provider_resource_id);
      if(existing.id!==claim.provider_resource_id||existing.client_reference_id!==user.id||existing.mode!=="subscription")
        return NextResponse.json({error:"Impossible de vérifier la demande de paiement existante."},{status:503});
      if(existing.status==="expired"){
        await finishProviderCheckout(db,"stripe",claim.provider_resource_id,"failed");
        return NextResponse.json({error:"La session précédente a expiré. Réessayez pour créer une nouvelle demande."},{status:409});
      }
      if(!existing.client_secret)return NextResponse.json({error:"Session de paiement en cours de vérification."},{status:503});
      return NextResponse.json({clientSecret:existing.client_secret,sessionId:existing.id},{headers:{"Cache-Control":"no-store"}});
    }
    if(!claim.attempt_id||typeof claim.fence!=="number"||!claim.idempotency_key)
      throw Error("Invalid checkout claim");
    let session:{id?:string;client_secret?:string;amount_total?:number;mode?:string};
    try{
      session=await stripeRequest<{id?:string;client_secret?:string;amount_total?:number;mode?:string}>(
        "/v1/checkout/sessions",{method:"POST",params,idempotencyKey:claim.idempotency_key});
    }catch(error){
      await finishCheckout(db,claim.attempt_id,claim.fence,"unknown");
      throw error;
    }
    if(!session.client_secret || !session.id || session.mode!=="subscription"
      || (session.amount_total!==null && session.amount_total!==undefined && session.amount_total!==PLAN_CENTS[tier]))
      return NextResponse.json({error:"Impossible de vérifier les détails de l'abonnement."},{status:502});
    await finishCheckout(db,claim.attempt_id,claim.fence,"pending",session.id);
    return NextResponse.json({
      clientSecret:session.client_secret,
      sessionId:session.id,
    },{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({error:"Paiement par carte temporairement indisponible. Aucun débit n'a été effectué par ALEK."},{status:503});
  }
}
