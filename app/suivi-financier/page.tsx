"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {supabase} from "../lib/supabase";
import {userFacingError} from "../lib/user-facing-error";

type Doc={id:string;document_type:string;document_number:string;document_date:string;due_date:string|null;client_name:string;client_email:string|null;client_phone:string|null;total_ttc:number;invoice_status:string|null};
type AccessState="loading"|"signed-out"|"auth-error"|"ready";

export default function Finances(){
 const [docs,setDocs]=useState<Doc[]>([]);
 const [error,setError]=useState("");
 const [userId,setUserId]=useState("");
 const [busy,setBusy]=useState("");
 const [access,setAccess]=useState<AccessState>("loading");

 const load=useCallback(async(id:string)=>{
  try {
   const {data,error:queryError}=await supabase.from("documents").select("id,document_type,document_number,document_date,due_date,client_name,client_email,client_phone,total_ttc,invoice_status").eq("user_id",id).order("document_date",{ascending:false}).limit(500);
   if(queryError){setError(userFacingError("load"));return false;}
   setDocs((data||[]) as Doc[]);
   setError("");
   return true;
  } catch {
   setError(userFacingError("load"));
   return false;
  }
 },[]);

 useEffect(()=>{
  let active=true;
  void (async()=>{
   try {
    const {data,error:authError}=await supabase.auth.getUser();
    if(!active)return;
    if(authError){setAccess("auth-error");setError(userFacingError("auth"));return;}
    if(!data.user){setAccess("signed-out");return;}
    setUserId(data.user.id);
    await load(data.user.id);
    if(active)setAccess("ready");
   } catch {
    if(active){setAccess("auth-error");setError(userFacingError("auth"));}
   }
  })();
  return()=>{active=false;};
 },[load]);

 const invoices=docs.filter(x=>x.document_type==="facture");
 const totals=useMemo(()=>{const today=new Date().toISOString().slice(0,10);return {paid:invoices.filter(x=>x.invoice_status==="paid").reduce((s,x)=>s+Number(x.total_ttc||0),0),unpaid:invoices.filter(x=>x.invoice_status!=="paid").reduce((s,x)=>s+Number(x.total_ttc||0),0),overdue:invoices.filter(x=>x.invoice_status!=="paid"&&!!x.due_date&&x.due_date<today).length};},[invoices]);
 const monthly=useMemo(()=>{const m=new Map<string,number>();for(const d of invoices){if(d.invoice_status!=="paid")continue;const k=d.document_date.slice(0,7);m.set(k,(m.get(k)||0)+Number(d.total_ttc||0));}return [...m.entries()].sort().slice(-12);},[invoices]);
 const max=Math.max(1,...monthly.map(x=>x[1]));

 async function mark(d:Doc,paid:boolean){
  if(!userId||busy)return;
  setBusy(d.id);setError("");
  try {
   const {error:updateError}=await supabase.from("documents").update({invoice_status:paid?"paid":"pending"}).eq("id",d.id).eq("user_id",userId);
   if(updateError){setError(userFacingError("payment-status"));return;}
   await load(userId);
  } catch {
   setError(userFacingError("payment-status"));
  } finally {
   setBusy("");
  }
 }

 async function share(d:Doc,channel:"whatsapp"|"sms"|"email"){
  setError("");
  try {
   const {data:{session},error:authError}=await supabase.auth.getSession();
   if(authError||!session){setError(userFacingError("auth"));return;}
   const response=await fetch("/api/documents/share",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({documentId:d.id,channel})});
   if(!response.ok){setError(userFacingError("share"));return;}
   const result=await response.json();
   if(typeof result.url!=="string"){setError(userFacingError("share"));return;}
   window.location.href=result.url;
  } catch {
   setError(userFacingError("share"));
  }
 }

 return <main className="mx-auto max-w-5xl space-y-6 p-5 text-slate-900"><Link href="/dashboard" className="text-blue-700">← Mon espace</Link><h1 className="text-3xl font-bold">Suivi des factures</h1><p className="text-slate-600">Les paiements sont marqués manuellement. Les montants ne sont pas des transactions bancaires vérifiées.</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {access==="loading"&&<p role="status" className="text-slate-600">Chargement de votre suivi…</p>}
  {(access==="signed-out"||access==="auth-error")&&<p className="rounded-xl bg-blue-50 p-4">Connectez-vous pour accéder à votre suivi. <Link href="/login" className="font-semibold text-blue-700 underline">Connexion</Link></p>}
  {access==="ready"&&<><div className="grid gap-3 sm:grid-cols-3">{[["Factures marquées payées",totals.paid.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"],["Restant à encaisser",totals.unpaid.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €"],["Factures en retard",String(totals.overdue)]].map(([k,v])=><div key={k} className="rounded-xl bg-blue-50 p-5"><p className="text-sm">{k}</p><p className="mt-2 text-2xl font-bold">{v}</p></div>)}</div><section className="rounded-xl border p-5"><h2 className="font-bold">Factures marquées payées par mois</h2><div className="mt-4 flex h-44 items-end gap-2">{monthly.map(([month,value])=><div key={month} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-blue-600" title={value.toLocaleString("fr-FR",{minimumFractionDigits:2})+" €"} style={{height:Math.max(2,Math.round(value/max*120))}}/><span className="text-xs">{month.slice(5)}</span></div>)}</div></section><section className="space-y-3">{invoices.map(d=><article key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><strong>{d.document_number}</strong><p>{d.client_name} · {Number(d.total_ttc||0).toLocaleString("fr-FR",{minimumFractionDigits:2})} €</p><p className="text-sm">{d.invoice_status==="paid"?"Payée":d.due_date&&d.due_date<new Date().toISOString().slice(0,10)?"En retard":"En attente"}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy===d.id||!!busy} onClick={()=>void mark(d,d.invoice_status!=="paid")} className="rounded-lg bg-blue-700 p-2 text-sm text-white disabled:opacity-50">{busy===d.id?"Mise à jour…":d.invoice_status==="paid"?"Annuler le statut payé":"Marquer payée"}</button><button onClick={()=>void share(d,"whatsapp")} className="rounded-lg border p-2 text-sm">WhatsApp</button><button onClick={()=>void share(d,"sms")} className="rounded-lg border p-2 text-sm">SMS</button><button onClick={()=>void share(d,"email")} className="rounded-lg border p-2 text-sm">E-mail</button></div></article>)}</section></>}
 </main>;
}
