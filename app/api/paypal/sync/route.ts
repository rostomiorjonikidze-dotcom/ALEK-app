import { NextResponse } from "next/server";
import { admin, subscription, userFrom } from "../_shared";
export const runtime="nodejs";
export async function POST(request:Request) {
 try {
  const user=await userFrom(request);
  if(!user) return NextResponse.json({error:"Connexion requise."},{status:401});
  const db=admin();
  const {data:profile,error}=await db.from("profiles").select("role,paypal_subscription_id").eq("id",user.id).maybeSingle();
  if(error || !profile) return NextResponse.json({error:"Profil indisponible."},{status:404});
  if(profile.role==="owner") return NextResponse.json({plan:"business",status:"OWNER"});
  const input=await request.json().catch(()=>({}));
  const requested=typeof input?.subscriptionId==="string" && /^I-[A-Z0-9]{8,30}$/i.test(input.subscriptionId) ? input.subscriptionId : null;
  const id=requested || profile.paypal_subscription_id;
  if(!id) return NextResponse.json({plan:"free",status:"NONE"});
  const details=await subscription(id);
  if(details.custom_id!==user.id) return NextResponse.json({error:"Cet abonnement n’appartient pas à votre compte."},{status:403});
  const pro=process.env.PAYPAL_PRO_PLAN_ID, business=process.env.PAYPAL_BUSINESS_PLAN_ID;
  const env=process.env.PAYPAL_ENV?.toLowerCase()==="live"?"live":"sandbox";
  const {data:aliases,error:aliasesError}=await db.from("artisan_paypal_plan_overrides")
    .select("tier,paypal_plan_id").eq("environment",env);
  if(aliasesError) return NextResponse.json({error:"Configuration de facturation indisponible."},{status:503});
  const matchedPlan=details.plan_id===pro?"pro":details.plan_id===business?"business":
    aliases?.find((row:{tier:string;paypal_plan_id:string})=>row.paypal_plan_id===details.plan_id)?.tier||null;
  if(matchedPlan!=="pro" && matchedPlan!=="business")
    return NextResponse.json({error:"Formule d’abonnement non reconnue."},{status:403});
  if(!matchedPlan) return NextResponse.json({error:"Formule d’abonnement non reconnue."},{status:403});
  const status=String(details.status || "").toUpperCase();
  const plan=status==="ACTIVE"?matchedPlan:"free";
  // Never replace a different active subscription with a pending one.
  if(requested && profile.paypal_subscription_id && profile.paypal_subscription_id!==requested) {
   const existing=await subscription(profile.paypal_subscription_id);
   if(existing.status==="ACTIVE") return NextResponse.json({error:"Un abonnement actif existe déjà."},{status:409});
  }
  const {error:updateError}=await db.from("profiles").update({plan,paypal_subscription_id:id,paypal_subscription_status:status,subscription_updated_at:new Date().toISOString()}).eq("id",user.id);
  if(updateError) return NextResponse.json({error:"Impossible d’enregistrer votre abonnement."},{status:500});
  return NextResponse.json({plan,status});
 } catch { return NextResponse.json({error:"Impossible de vérifier l’abonnement PayPal."},{status:503}); }
}
