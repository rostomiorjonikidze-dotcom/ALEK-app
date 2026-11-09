import {remainingPlan} from "../../../../lib/payment-policy";
import {NextResponse} from "next/server";
import {admin,paypalBase,paypalToken,subscription,userFrom} from "../../_shared";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
 const user=await userFrom(request);if(!user)return NextResponse.json({error:"Connexion requise"},{status:401});
 const db=admin();const {data:profile,error}=await db.from("profiles").select("role,paypal_subscription_id,stripe_subscription_status,stripe_price_id").eq("id",user.id).maybeSingle();
 if(error)return NextResponse.json({error:"Impossible de vérifier le compte"},{status:503});
 const id=profile?.paypal_subscription_id;
 if(!id)return NextResponse.json({error:"Aucun abonnement PayPal lié à ce compte. Consultez vos paiements automatiques PayPal ou contactez le support."},{status:404});
 const plan=remainingPlan(profile,{pro:process.env.STRIPE_PRO_PRICE_ID,business:process.env.STRIPE_BUSINESS_PRICE_ID});
 const current=await subscription(id);
 if(current.custom_id!==user.id)return NextResponse.json({error:"Impossible de vérifier le titulaire de l’abonnement"},{status:403});
 if(current.status==="CANCELLED"||current.status==="EXPIRED"){const {error:syncError}=await db.from("profiles").update({plan,paypal_subscription_status:current.status,subscription_updated_at:new Date().toISOString()}).eq("id",user.id).eq("paypal_subscription_id",id);if(syncError)return NextResponse.json({error:"Abonnement résilié, mais synchronisation du compte indisponible."},{status:503});return NextResponse.json({status:current.status,message:"Abonnement déjà résilié."});}
 const token=await paypalToken();
 const result=await fetch(paypalBase()+"/v1/billing/subscriptions/"+encodeURIComponent(id)+"/cancel",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","PayPal-Request-Id":crypto.randomUUID()},body:JSON.stringify({reason:"Résiliation demandée par le titulaire depuis ALEK"}),cache:"no-store"});
 if(!result.ok)return NextResponse.json({error:"PayPal n’a pas confirmé la résiliation. Réessayez ou contactez le support."},{status:502});
 const verified=await subscription(id);
 if(verified.status!=="CANCELLED")return NextResponse.json({status:verified.status,message:"Demande envoyée. Vérifiez votre compte PayPal et contactez le support si nécessaire."});
 const {error:updateError}=await db.from("profiles").update({plan,paypal_subscription_status:"CANCELLED",subscription_updated_at:new Date().toISOString()}).eq("id",user.id).eq("paypal_subscription_id",id);
 if(updateError)return NextResponse.json({status:"CANCELLED",message:"Résiliation confirmée par PayPal, mais synchronisation du compte en attente. Contactez le support."});
 return NextResponse.json({status:"CANCELLED",message:"Résiliation confirmée par PayPal. Aucun nouveau renouvellement de cet abonnement."});
 }catch{return NextResponse.json({error:"Service PayPal indisponible. Vous pouvez aussi résilier depuis votre compte PayPal."},{status:503});}
}