import {NextResponse} from "next/server";
import {admin,userFrom} from "../../../paypal/_shared";
import {getSubscription,stripeRequest} from "../../../../lib/stripe-billing";
export const runtime="nodejs";
export async function POST(request:Request){
  try{
    const user=await userFrom(request);
    if(!user)return NextResponse.json({error:"Connexion requise."},{status:401});
    const db=admin();
    const {data:profile,error}=await db.from("profiles").select("stripe_subscription_id").eq("id",user.id).maybeSingle();
    if(error||!profile?.stripe_subscription_id)return NextResponse.json({error:"Aucun abonnement par carte associé à ce compte."},{status:404});
    const id=String(profile.stripe_subscription_id);
    const current=await getSubscription(id);
    if(current.metadata?.user_id!==user.id)return NextResponse.json({error:"Abonnement non autorisé."},{status:403});
    if(["canceled","incomplete_expired"].includes(current.status))return NextResponse.json({status:"CANCELLED",message:"Abonnement déjà résilié."});
    const params=new URLSearchParams({cancel_at_period_end:"true"});
    const result=await stripeRequest<{id:string;cancel_at_period_end?:boolean}>("/v1/subscriptions/"+id,{method:"POST",params});
    if(!result.cancel_at_period_end)return NextResponse.json({error:"Stripe n'a pas confirmé la résiliation."},{status:502});
    return NextResponse.json({status:"CANCELLATION_SCHEDULED",message:"Résiliation programmée à la fin de la période déjà payée. Aucun nouveau renouvellement n'aura lieu."});
  }catch{return NextResponse.json({error:"Impossible de résilier actuellement. Contactez le support."},{status:503});}
}
