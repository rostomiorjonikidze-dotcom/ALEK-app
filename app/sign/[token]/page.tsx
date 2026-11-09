"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { serviceTotal, type PriceLine } from "../../lib/document-math";

const euros = (value: number) => value.toLocaleString("fr-FR", {style:"currency", currency:"EUR"});

type Quote = { document_number:string; document_date:string; due_date?:string; vat_exempt?:boolean; client_name:string; client_address:string; business_name:string; business_address:string; business_siret:string; description:string; services:({description:string} & Partial<PriceLine>)[]; total_ht:number; total_vat:number; total_ttc:number; vat_rate:number };
type View = { status:string; doc:Quote; snapshotHash:string; signedAt?:string; signerName?:string; signatureHash?:string };
export default function SignQuotePage() {
  const params = useParams<{token:string}>();
  const token = params?.token || "";
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({x:0,y:0});
  const [view, setView] = useState<View|null>(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [name,setName] = useState("");
  const [accept,setAccept] = useState(false);
  const [ink,setInk] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/signatures/"+encodeURIComponent(token), {cache:"no-store"});
      const result = await response.json();
      if (!response.ok) throw Error(result.error||"Lien invalide");
      setError("");
      setView(result);
    } catch {setError("Impossible de charger le devis. Vérifiez le lien ou réessayez plus tard.");}
  },[token]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Existing dynamic integration; tracked for typed/lifecycle refactor.
  useEffect(()=>{ if(token) void load(); },[token,load]);
  useEffect(()=>{
    const el=canvas.current;
    if (!el) return;
    const ratio=window.devicePixelRatio||1;
    el.width=600*ratio;el.height=170*ratio;
    const context=el.getContext("2d");
    if(context){context.scale(ratio,ratio);context.lineWidth=2.8;context.lineCap="round";context.strokeStyle="#122f69";context.fillStyle="#fff";context.fillRect(0,0,600,170);}
  },[view?.status]);
  function position(e:React.PointerEvent<HTMLCanvasElement>) {
    const rect=e.currentTarget.getBoundingClientRect();
    return {x:(e.clientX-rect.left)*600/rect.width,y:(e.clientY-rect.top)*170/rect.height};
  }
  function start(e:React.PointerEvent<HTMLCanvasElement>){ e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;last.current=position(e); }
  function move(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing.current)return; const ctx=canvas.current?.getContext("2d");if(!ctx)return;const next=position(e);ctx.beginPath();ctx.moveTo(last.current.x,last.current.y);ctx.lineTo(next.x,next.y);ctx.stroke();last.current=next;setInk(true);}
  function stop(){drawing.current=false;}
  function clear(){const ctx=canvas.current?.getContext("2d");if(ctx){ctx.fillStyle="#fff";ctx.fillRect(0,0,600,170);}setInk(false);}
  async function sign(){
    if(!accept||!ink||name.trim().length<3||!canvas.current){setError("Renseignez votre nom, signez et acceptez explicitement.");return;}
    setBusy(true);setError("");
    try {
      const res=await fetch("/api/signatures/"+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name.trim(),accept,signature:canvas.current.toDataURL("image/png")})});
      const response=await res.json();
      if(!res.ok)throw Error(response.error||"Signature refusée.");
      await load();
    } catch {setError("Impossible d’enregistrer la signature. Vérifiez votre connexion et réessayez.");}finally{setBusy(false);}
  }
  async function downloadProof(){
    if(!view||view.status!=="signed")return;
    setBusy(true);setError("");
    try {
    const { jsPDF } = await import("jspdf");
    const pdf=new jsPDF();
    pdf.setFontSize(20);pdf.text("ATTESTATION DE SIGNATURE SIMPLE",18,25);
    pdf.setFontSize(11);
    const entries=[
      "Devis: "+(view.doc.document_number||""),"Prestataire: "+(view.doc.business_name||""),
      "Client: "+(view.doc.client_name||""),"Montant TTC: "+Number(view.doc.total_ttc||0).toFixed(2)+" EUR",
      "Signataire: "+(view.signerName||""),"Date d'acceptation: "+(view.signedAt||""),
      "Référence document (SHA-256):",view.snapshotHash,
      "Référence preuve (SHA-256):",view.signatureHash||"",
      "Signature électronique simple: identité non vérifiée par prestataire qualifié.",
    ];
    let y=43;for(const item of entries){for(const line of pdf.splitTextToSize(item,175)){if(y>275){pdf.addPage();y=25;}pdf.text(line,18,y);y+=7;}y+=3;}
    pdf.save("ALEK-Attestation-"+(view.doc.document_number||"devis").replace(/[^a-zA-Z0-9_-]/g,"_")+".pdf");
    } catch {setError("Impossible de créer l’attestation. Réessayez.");} finally {setBusy(false);}
  }
  return <main className="min-h-screen bg-[#f3f6fc] px-4 py-12 text-[#14213b]">
    <div className="mx-auto max-w-3xl space-y-6 break-words">
      <header className="rounded-3xl bg-[#0b2449] px-8 py-7 text-white"><p className="text-sm font-bold text-blue-200">ALEK Artisan · Accord client</p><h1 className="mt-2 text-3xl font-black">Signature du devis</h1><p className="mt-2 text-sm text-blue-100">Consultez le devis avant toute acceptation. Le lien est personnel et expire après 14 jours.</p></header>
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {!view&&!error&&<p role="status">Chargement du devis…</p>}
      {view&&<section className="space-y-5 rounded-3xl bg-white p-6 shadow-lg sm:p-9">
        <div className="flex flex-wrap justify-between gap-4 border-b pb-5"><div><p className="text-xs font-bold uppercase text-blue-600">Prestataire</p><h2 className="text-xl font-black">{view.doc.business_name}</h2><p className="text-sm text-slate-600">{view.doc.business_address}</p><p className="text-sm text-slate-600">SIRET : {view.doc.business_siret}</p></div><div><p className="text-xs font-bold uppercase text-blue-600">Devis</p><strong>{view.doc.document_number}</strong><p>{view.doc.document_date}</p>{view.doc.due_date&&<p>Valable jusqu’au {view.doc.due_date}</p>}</div></div>
        <p><strong>Client : </strong>{view.doc.client_name}<span className="block text-sm text-slate-500">{view.doc.client_address}</span></p>
        {view.doc.description&&<p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4">{view.doc.description}</p>}
        <div className="space-y-3">{(view.doc.services||[]).map((line,i)=><div key={i} className="flex justify-between gap-4 border-b pb-3 text-sm"><span className="min-w-0">{line.description}<span className="block text-xs text-slate-500">{line.priceType==="hourly" ? `${line.hours ?? 0} h × ${euros(Number(line.price||0))}` : line.priceType==="unit" ? `${line.quantity ?? 0} × ${euros(Number(line.price||0))}` : "Forfait"}</span></span><span className="shrink-0">{euros(serviceTotal({priceType:line.priceType||"total", quantity:line.quantity??0, hours:line.hours??0, price:line.price??0}))} HT</span></div>)}</div>
        {view.doc.vat_exempt&&<p className="text-sm">TVA non applicable, art. 293 B du CGI.</p>}
        <div className="text-right"><p>HT : {euros(Number(view.doc.total_ht||0))}</p><p>TVA : {euros(Number(view.doc.total_vat||0))}</p><p className="text-2xl font-black text-blue-700">Total TTC : {euros(Number(view.doc.total_ttc||0))}</p></div>
        {view.status==="signed"?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="font-black text-emerald-800">Devis accepté</h3><p className="mt-1 text-sm">Signataire : {view.signerName} · {view.signedAt}</p><button disabled={busy} onClick={()=>void downloadProof()} className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Télécharger l&apos;attestation PDF</button></div>:
        view.status==="pending"?<div className="space-y-4 border-t pt-5"><h3 className="text-xl font-bold">Votre accord</h3><label className="block text-sm font-semibold">Votre nom complet<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} className="mt-2 w-full rounded-xl border p-3" placeholder="Nom et prénom"/></label><p className="text-sm font-semibold">Tracez votre signature au doigt ou à la souris</p><p className="text-xs text-slate-600">Si vous ne pouvez pas tracer votre signature, contactez le prestataire pour convenir d’un autre mode d’acceptation.</p>
          <canvas ref={canvas} className="w-full touch-none rounded-xl border-2 border-dashed border-blue-200 bg-white" style={{height:170}} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label="Zone de signature manuscrite"/>
          <button className="text-sm text-blue-700 underline" onClick={clear}>Effacer la signature</button>
          <label className="flex gap-3 text-sm"><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)}/><span>Je déclare avoir pris connaissance du devis ci-dessus et souhaite l&apos;accepter. J&apos;autorise l&apos;enregistrement de ma signature, de la date et de données techniques minimales comme preuve.</span></label>
          <p className="text-xs text-slate-500">Signature électronique simple : cette procédure ne vérifie pas fortement votre identité et ne constitue pas une signature qualifiée eIDAS. En cas d&apos;enjeu juridique important, utilisez un prestataire de confiance.</p>
          <button type="button" disabled={busy||!accept||!ink||name.trim().length<3} onClick={()=>void sign()} className="w-full rounded-xl bg-blue-700 px-6 py-4 font-bold text-white disabled:opacity-50">{busy?"Enregistrement…":"Signer et accepter le devis"}</button>
        </div>:<p role="status">Cette demande n’est plus disponible.</p>}
      </section>}
    </div>
  </main>;
}
