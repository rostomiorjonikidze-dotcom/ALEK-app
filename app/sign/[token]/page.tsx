"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { jsPDF } from "jspdf";

type Quote = { document_number:string; document_date:string; client_name:string; client_address:string; business_name:string; business_address:string; business_siret:string; description:string; services:{description:string;quantity?:number;price?:number}[]; total_ht:number; total_vat:number; total_ttc:number; vat_rate:number };
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
      setView(result);
    } catch(e) {setError(e instanceof Error?e.message:"Lien indisponible");}
  },[token]);
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
    } catch(e){setError(e instanceof Error?e.message:"Erreur");}finally{setBusy(false);}
  }
  function downloadProof(){
    if(!view||view.status!=="signed")return;
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
    let y=43;for(const item of entries){const lines=pdf.splitTextToSize(item,175);pdf.text(lines,18,y);y+=lines.length*7+3;}
    pdf.save("ALEK-Attestation-"+(view.doc.document_number||"devis").replace(/[^a-zA-Z0-9_-]/g,"_")+".pdf");
  }
  return <main className="min-h-screen bg-[#f3f6fc] px-4 py-12 text-[#14213b]">
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rounded-3xl bg-[#0b2449] px-8 py-7 text-white"><p className="text-sm font-bold text-blue-200">ALEK Artisan · Accord client</p><h1 className="mt-2 text-3xl font-black">Signature du devis</h1><p className="mt-2 text-sm text-blue-100">Consultez le devis avant toute acceptation. Le lien est personnel et expire après 14 jours.</p></header>
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {!view&&!error&&<p>Chargement du devis…</p>}
      {view&&<section className="space-y-5 rounded-3xl bg-white p-6 shadow-lg sm:p-9">
        <div className="flex flex-wrap justify-between gap-4 border-b pb-5"><div><p className="text-xs font-bold uppercase text-blue-600">Prestataire</p><h2 className="text-xl font-black">{view.doc.business_name}</h2><p className="text-sm text-slate-600">{view.doc.business_address}</p><p className="text-sm text-slate-600">SIRET : {view.doc.business_siret}</p></div><div><p className="text-xs font-bold uppercase text-blue-600">Devis</p><strong>{view.doc.document_number}</strong><p>{view.doc.document_date}</p></div></div>
        <p><strong>Client : </strong>{view.doc.client_name}<span className="block text-sm text-slate-500">{view.doc.client_address}</span></p>
        {view.doc.description&&<p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4">{view.doc.description}</p>}
        <div className="space-y-3">{(view.doc.services||[]).map((line,i)=><div key={i} className="flex justify-between gap-4 border-b pb-3 text-sm"><span>{line.description}</span><span>{Number(line.price||0).toFixed(2)} €</span></div>)}</div>
        <div className="text-right"><p>HT : {Number(view.doc.total_ht||0).toFixed(2)} €</p><p>TVA : {Number(view.doc.total_vat||0).toFixed(2)} €</p><p className="text-2xl font-black text-blue-700">Total TTC : {Number(view.doc.total_ttc||0).toFixed(2)} €</p></div>
        {view.status==="signed"?<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="font-black text-emerald-800">Devis accepté</h3><p className="mt-1 text-sm">Signataire : {view.signerName} · {view.signedAt}</p><button onClick={downloadProof} className="mt-4 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">Télécharger l'attestation PDF</button></div>:
        <div className="space-y-4 border-t pt-5"><h3 className="text-xl font-bold">Votre accord</h3><label className="block text-sm font-semibold">Votre nom complet<input value={name} onChange={e=>setName(e.target.value)} maxLength={120} className="mt-2 w-full rounded-xl border p-3" placeholder="Nom et prénom"/></label><label className="block text-sm font-semibold">Tracez votre signature au doigt ou à la souris</label>
          <canvas ref={canvas} className="w-full touch-none rounded-xl border-2 border-dashed border-blue-200 bg-white" style={{height:170}} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label="Zone de signature manuscrite"/>
          <button className="text-sm text-blue-700 underline" onClick={clear}>Effacer la signature</button>
          <label className="flex gap-3 text-sm"><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)}/><span>Je déclare avoir pris connaissance du devis ci-dessus et souhaite l'accepter. J'autorise l'enregistrement de ma signature, de la date et de données techniques minimales comme preuve.</span></label>
          <p className="text-xs text-slate-500">Signature électronique simple : cette procédure ne vérifie pas fortement votre identité et ne constitue pas une signature qualifiée eIDAS. En cas d'enjeu juridique important, utilisez un prestataire de confiance.</p>
          <button type="button" disabled={busy||!accept||!ink} onClick={()=>void sign()} className="w-full rounded-xl bg-blue-700 px-6 py-4 font-bold text-white disabled:opacity-50">{busy?"Enregistrement…":"Signer et accepter le devis"}</button>
        </div>}
      </section>}
    </div>
  </main>;
}
