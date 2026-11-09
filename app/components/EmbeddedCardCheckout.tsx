"use client";
import Script from "next/script";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {supabase} from "../lib/supabase";

class PaymentMessage extends Error {}

type Tier="pro"|"business";
type EmbeddedInstance={mount:(element:HTMLElement)=>void;destroy:()=>void};
type StripeInstance={initEmbeddedCheckout:(options:{
  fetchClientSecret:()=>Promise<string>;
  onComplete:()=>void;
})=>Promise<EmbeddedInstance>};
declare global{
  interface Window{
    Stripe?: (publishableKey:string)=>StripeInstance;
  }
}
export default function EmbeddedCardCheckout({plan,onDone}:{plan:Tier;onDone:(message:string)=>void}){
  const router=useRouter();
  const mountRef=useRef<HTMLDivElement>(null);
  const onDoneRef=useRef(onDone);
  useEffect(()=>{onDoneRef.current=onDone;},[onDone]);
  const [key,setKey]=useState("");
  const [scriptLoaded,setScriptLoaded]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    let canceled=false;
    async function config(){
      try{
        const response=await fetch("/api/stripe/config",{cache:"no-store"});
        const data=await response.json();
        if(canceled)return;
        if(!data.available||!data.publishableKey){
          setError("Paiement par carte bientôt disponible : le compte de paiement doit être activé. Aucun paiement n'a été lancé.");
          setLoading(false);
          return;
        }
        setKey(data.publishableKey);
      }catch{
        if(!canceled){setError("Impossible de vérifier la disponibilité du paiement par carte.");setLoading(false);}
      }
    }
    void config();
    return()=>{canceled=true;};
  },[]);

  useEffect(()=>{
    if(!key||!scriptLoaded||!mountRef.current)return;
    let disposed=false;
    let checkout:EmbeddedInstance|null=null;
    let sessionId:string|null=null;
    async function initialize(){
      try{
        const {data:{session}}=await supabase.auth.getSession();
        if(disposed)return;
        if(!session){router.push("/login");return;}
        const stripe=window.Stripe?.(key);
        if(!stripe)throw new PaymentMessage("Chargement du paiement sécurisé impossible.");
        const payment=await stripe.initEmbeddedCheckout({
          fetchClientSecret:async()=>{
            if(disposed)throw new PaymentMessage("Initialisation annulée.");
            const resp=await fetch("/api/stripe/checkout",{
              method:"POST",
              headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
              body:JSON.stringify({plan})
            });
            const result=await resp.json();
            if(!resp.ok||!result.clientSecret||!result.sessionId)
              throw new PaymentMessage(result.error||"Initialisation du paiement impossible.");
            if(disposed)throw new PaymentMessage("Initialisation annulée.");
            sessionId=result.sessionId;
            return result.clientSecret;
          },
          onComplete:()=>{
            if(disposed)return;
            void (async()=>{
              try{
                const {data:{session:current}}=await supabase.auth.getSession();
                if(!current||!sessionId)throw new PaymentMessage("Session expirée. Reconnectez-vous.");
                const response=await fetch("/api/stripe/confirm",{
                  method:"POST",
                  headers:{"Authorization":"Bearer "+current.access_token,"Content-Type":"application/json"},
                  body:JSON.stringify({sessionId:sessionId})
                });
                const result=await response.json();
                if(!response.ok)throw new PaymentMessage(result.error||"Vérification du paiement impossible.");
                if(!disposed)onDoneRef.current(result.message||"Paiement enregistré. Vérification de l'abonnement en cours.");
              }catch(e){if(!disposed)onDoneRef.current(e instanceof PaymentMessage?e.message:"Vérification en attente. Contactez le support si nécessaire.");}
            })();
          },
        });
        if(disposed){payment.destroy();return;}
        checkout=payment;
        if(!mountRef.current){payment.destroy();return;}
        payment.mount(mountRef.current);
        setLoading(false);
      }catch(e){
        if(!disposed){setError(e instanceof PaymentMessage?e.message:"Le formulaire de carte est temporairement indisponible.");setLoading(false);}
      }
    }
    void initialize();
    return()=>{disposed=true;checkout?.destroy();};
  },[key,scriptLoaded,plan,router]);

  return(
    <section id="paiement-par-carte" className="mt-8 scroll-mt-28 rounded-3xl border border-blue-200 bg-white px-4 py-7 shadow-lg sm:px-8">
      <h2 className="text-2xl font-black text-[#14213b]">Paiement sécurisé par carte</h2>
      <p className="mt-2 text-sm text-slate-600">
        Formule {plan==="pro"?"Pro — 19,99 € / mois":"Business — 49,99 € / mois"}.
        Saisie de la carte directement sur ALEK Artisan, sans redirection vers PayPal.
      </p>
      <p className="mt-3 text-xs text-slate-500">
        Abonnement renouvelé automatiquement chaque mois jusqu&apos;à résiliation.
        Les données de votre carte sont traitées par Stripe et ne sont pas enregistrées par ALEK.
      </p>
      {key&&<Script src="https://js.stripe.com/v3/" strategy="afterInteractive" onReady={()=>setScriptLoaded(true)} onError={()=>{setError("Le formulaire Stripe n'a pas pu être chargé.");setLoading(false);}}/>}
      {loading&&!error&&<p role="status" className="mt-5 text-sm font-semibold text-slate-600">Chargement du formulaire sécurisé…</p>}
      {error&&<p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>}
      <div ref={mountRef} className="mt-6 min-h-0 w-full"/>
    </section>
  );
}
