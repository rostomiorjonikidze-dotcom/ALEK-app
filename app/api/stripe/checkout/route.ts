import {hasBlockingStripeSubscription} from "../../../lib/payment-policy";
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
    const session=await stripeRequest<{id?:string;client_secret?:string;amount_total?:number;mode?:string;url?:string}>(
      "/v1/checkout/sessions",{method:"POST",params});
    if(!session.client_secret || !session.id || session.mode!=="subscription"
      || (session.amount_total!==null && session.amount_total!==undefined && session.amount_total!==PLAN_CENTS[tier]))
      return NextResponse.json({error:"Impossible de vérifier les détails de l'abonnement."},{status:502});
    return NextResponse.json({
      clientSecret:session.client_secret,
      sessionId:session.id,
    },{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({error:"Paiement par carte temporairement indisponible. Aucun débit n'a été effectué par ALEK."},{status:503});
  }
}
