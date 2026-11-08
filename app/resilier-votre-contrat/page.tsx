"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "../lib/supabase";
export default function Resilier(){const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[done,setDone]=useState(false);
async function cancel(){
 if(!window.confirm("Confirmez-vous la résiliation de votre abonnement ALEK ?"))return;
 setBusy(true);setMessage("");
 try{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){router.push("/login");return;}
  const {data:profile,error:profileError}=await supabase.from("profiles")
    .select("stripe_subscription_id,stripe_subscription_status").eq("id",session.user.id).maybeSingle();
  if(profileError)throw Error("Vérification du compte impossible.");
  const stripeActive=Boolean(profile?.stripe_subscription_id)
    && !["canceled","incomplete_expired"].includes(String(profile?.stripe_subscription_status||""));
  const url=stripeActive?"/api/stripe/subscription/cancel":"/api/paypal/subscription/cancel";
  const response=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+session.access_token}});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||"Résiliation impossible.");
  setMessage(result.message||"Demande traitée.");
  setDone(result.status==="CANCELLED"||result.status==="CANCELLATION_SCHEDULED");
 }catch(e){setMessage(e instanceof Error?e.message:"Erreur de résiliation.");}
 finally{setBusy(false);}
}
return <main className="mx-auto max-w-2xl px-5 py-16 text-slate-900"><Link href="/pricing" className="text-blue-700 underline">← Tarifs</Link><h1 className="mt-8 text-3xl font-bold">Résilier votre contrat</h1><p className="mt-4">Vous pouvez demander la résiliation de votre abonnement ALEK en ligne, sans devoir téléphoner. Connectez-vous au compte ayant souscrit l’abonnement.</p><p className="mt-3 text-sm text-slate-600">Pour un abonnement par carte, la résiliation est programmée à la fin de la période déjà payée, sans nouveau renouvellement. Les anciens abonnements PayPal peuvent également être résiliés ici. Si votre abonnement n’apparaît pas, contactez le support.</p><button disabled={busy||done} onClick={()=>void cancel()} className="mt-7 rounded-xl bg-slate-900 px-6 py-4 font-bold text-white disabled:opacity-50">{busy?"Traitement…":done?"Abonnement résilié":"Résilier mon abonnement"}</button>{message&&<p role="status" className="mt-4 rounded-xl bg-slate-100 p-4">{message}</p>}<p className="mt-6 text-sm">Besoin d’aide ? <a href="mailto:support@alek.best" className="underline">support@alek.best</a></p></main>}