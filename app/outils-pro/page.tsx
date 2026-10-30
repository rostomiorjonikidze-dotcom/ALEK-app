"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import { supabase } from "../lib/supabase";
import { buildTemplate, checkCompliance, paymentClauses, reminder, type ClientKind, type ComplianceInput, type TemplateKind } from "../lib/pro-compliance";

type Doc = {
  id:string; document_type:"devis"|"facture"; document_number:string; document_date:string;
  client_name:string; client_address:string; client_email:string; client_phone:string;
  business_name:string; business_address:string; business_siret:string;
  description:string; services:{description:string;quantity?:number;price?:number}[];
  vat_rate:number; total_ht:number; total_ttc:number; due_date:string;
  payment_terms:string; invoice_status:string;
};
type Expense = { id:string; merchant:string; document_date:string|null; total_ttc:number; total_ht:number|null; vat_amount:number|null; category:string; description:string|null; invoice_number:string|null; currency:string };
type Scan = { merchant:string; date:string; total_ttc:number|null; total_ht:number|null; vat:number|null; category:string; description:string; invoice_number:string; currency:string; confidence:number };
type Tab = "scanner"|"conformite"|"modeles"|"relances"|"signature";
const categories = [["materiaux","Matériaux"],["carburant","Carburant"],["transport","Transport"],["outillage","Outillage"],["repas","Repas"],["logiciels","Logiciels"],["telecom","Télécommunications"],["loyer","Loyer"],["assurance","Assurance"],["autres","Autres"]];
const tabs: {key:Tab;icon:string;name:string}[] = [
  {key:"scanner",icon:"◈",name:"Scanner des reçus"},{key:"conformite",icon:"✓",name:"Conformité"},{key:"modeles",icon:"▤",name:"Modèles français"},{key:"relances",icon:"✉",name:"Relances clients"},{key:"signature",icon:"✎",name:"Signature du devis"}
];
const inputClass="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#14213b] outline-none focus:border-blue-500";
const primary="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondary="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50";
function downloadText(content:string,name:string){const blob=new Blob([content],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function Field({title,children}:{title:string;children:React.ReactNode}){return <label className="block space-y-2 text-sm font-semibold text-slate-700"><span>{title}</span>{children}</label>;}
function money(value:unknown){return Number(value||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});}
export default function ProToolsPage(){
  const [tab,setTab]=useState<Tab>("scanner");
  const [userId,setUserId]=useState("");
  const [documents,setDocuments]=useState<Doc[]>([]);
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [scan,setScan]=useState<Scan|null>(null);
  const [scanFile,setScanFile]=useState<File|null>(null);
  const [selected,setSelected]=useState("");
  const [clientKind,setClientKind]=useState<ClientKind>("professionnel");
  const [clientSiren,setClientSiren]=useState("");
  const [vatExempt,setVatExempt]=useState(false);
  const [sector,setSector]=useState("");
  const [templateKind,setTemplateKind]=useState<TemplateKind>("contrat");
  const [templateInfo,setTemplateInfo]=useState({provider:"",providerAddress:"",providerSiret:"",client:"",clientAddress:"",description:"",amount:"",deadline:""});
  const [relanceKind,setRelanceKind]=useState<"devis"|"avant"|"retard">("avant");
  const [signatureLink,setSignatureLink]=useState("");
  const [signatureRequests,setSignatureRequests]=useState<{id:string;document_id:string;status:string;signer_name:string|null;signed_at:string|null;created_at:string;expires_at:string;signature_sha256:string|null}[]>([]);
  const selectedDoc=useMemo(()=>documents.find(d=>d.id===selected)||null,[documents,selected]);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!active)return;
      if(!user){window.location.assign("/login");return;}
      setUserId(user.id);
      const [d,e]=await Promise.all([
        supabase.from("documents").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100),
        supabase.from("artisan_expenses").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50)
      ]);
      if(!active)return;
      if(d.error)setMessage("Impossible de charger les documents.");
      else {setDocuments(d.data||[]); if(d.data?.length)setSelected(d.data[0].id);}
      if(!e.error)setExpenses(e.data||[]);
    })();
    return()=>{active=false;};
  },[]);
  const checks=useMemo(()=>{
    if(!selectedDoc)return [];
    const d=selectedDoc;
    const values:ComplianceInput={
      kind:d.document_type, clientKind, documentNumber:d.document_number, issueDate:d.document_date,
      clientName:d.client_name, clientAddress:d.client_address,clientSiren,
      sellerName:d.business_name,sellerAddress:d.business_address,sellerSiret:d.business_siret,
      vatExempt,vatRate:d.vat_rate,lines:d.services,amountHT:d.total_ht,amountTTC:d.total_ttc,
      dueDate:d.document_type==="facture"?d.due_date:"",paymentTerms:d.payment_terms,
      latePaymentTerms:d.payment_terms?.toLowerCase().includes("pénalité")?d.payment_terms:"",
      sector, deliveryDate:""
    };
    return checkCompliance(values);
  },[selectedDoc,clientKind,clientSiren,vatExempt,sector]);
  const template=useMemo(()=>buildTemplate(templateKind,{...templateInfo,clientKind}),[templateKind,templateInfo,clientKind]);
  const relance=useMemo(()=>reminder(relanceKind,{
    client:selectedDoc?.client_name||"",reference:selectedDoc?.document_number||"",
    amount:money(selectedDoc?.total_ttc),deadline:selectedDoc?.due_date||"",company:selectedDoc?.business_name||"Votre entreprise",
  }),[relanceKind,selectedDoc]);
  async function scanReceipt(){
    if(!scanFile||busy)return;
    if(scanFile.size>4_000_000||!["image/jpeg","image/png","image/webp"].includes(scanFile.type)){setMessage("Sélectionnez une image JPG, PNG ou WEBP de 4 Mo maximum.");return;}
    setMessage("");setBusy(true);
    try {
      const fileData=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(Error("Fichier illisible"));reader.readAsDataURL(scanFile);
      });
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw Error("Session expirée.");
      const response=await fetch("/api/receipts/scan",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({image:fileData})});
      const body=await response.json();
      if(!response.ok)throw Error(body.error||"Analyse impossible.");
      setScan(body.data);
      setMessage("Extraction terminée. Vérifiez chaque champ avant de sauvegarder.");
    }catch(e){setMessage(e instanceof Error?e.message:"Erreur d'analyse.");}finally{setBusy(false);}
  }
  async function saveExpense(){
    if(!userId||!scan||scan.total_ttc===null||!Number.isFinite(scan.total_ttc)||scan.total_ttc<0){setMessage("Le montant TTC doit être vérifié et renseigné.");return;}
    setBusy(true);setMessage("");
    try {
      const {data,error}=await supabase.from("artisan_expenses").insert({
        user_id:userId,merchant:scan.merchant.trim()||"Fournisseur non précisé",
        document_date:scan.date||null, total_ttc:scan.total_ttc, total_ht:scan.total_ht,
        vat_amount:scan.vat,category:scan.category,description:scan.description||null,
        invoice_number:scan.invoice_number||null,currency:scan.currency||"EUR",source:"ocr_verified",
      }).select("*").single();
      if(error)throw Error(error.message);
      setExpenses(prev=>[data,...prev]);setScan(null);setScanFile(null);
      setMessage("Dépense enregistrée. La photo d'origine n'a pas été conservée.");
    }catch(e){setMessage(e instanceof Error?e.message:"Enregistrement impossible.");}finally{setBusy(false);}
  }
  function editScan(field:keyof Scan,value:string){
    setScan(prev=>prev?{...prev,[field]:["total_ttc","total_ht","vat","confidence"].includes(field)?(value===""?null:Number(value)):value}:prev);
  }
  function fillTemplateFromDocument(){
    if(!selectedDoc)return;
    setTemplateInfo({provider:selectedDoc.business_name||"",providerAddress:selectedDoc.business_address||"",providerSiret:selectedDoc.business_siret||"",client:selectedDoc.client_name||"",clientAddress:selectedDoc.client_address||"",description:selectedDoc.description||selectedDoc.services?.map(s=>s.description).join("; ")||"",amount:money(selectedDoc.total_ttc)+" TTC",deadline:selectedDoc.due_date||""});
  }
  async function refreshSignatures(){
    try { const {data:{session}}=await supabase.auth.getSession(); if(!session)return;
      const res=await fetch("/api/signatures",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
      if(res.ok){const body=await res.json();setSignatureRequests(body.requests||[]);}
    } catch {/* Liste facultative, pas de blocage de la création de devis. */}
  }
  async function createSignatureLink(){
    if(!selectedDoc||selectedDoc.document_type!=="devis")return;
    setBusy(true);setMessage("");setSignatureLink("");
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw Error("Veuillez vous reconnecter.");
      const response=await fetch("/api/signatures",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({documentId:selectedDoc.id})});
      const body=await response.json();if(!response.ok)throw Error(body.error||"Création impossible");
      setSignatureLink(body.url);setMessage("Lien créé, valable 14 jours. Envoyez-le seulement au destinataire prévu.");await refreshSignatures();
    }catch(e){setMessage(e instanceof Error?e.message:"Création impossible");}finally{setBusy(false);}
  }
  const docSelector=<select className={inputClass} value={selected} onChange={e=>{setSelected(e.target.value);setSignatureLink("");}}><option value="">Choisir un document enregistré</option>{documents.map(doc=><option key={doc.id} value={doc.id}>{doc.document_type==="devis"?"Devis":"Facture"} {doc.document_number||"sans numéro"} · {doc.client_name||"Sans client"}</option>)}</select>;
  return <main className="min-h-screen bg-[#f3f6fc] text-[#14213b]"><SiteHeader/>
    <section className="bg-gradient-to-br from-[#06162e] via-[#143770] to-[#1d57ad] px-5 py-14 text-white"><div className="mx-auto max-w-7xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-200">ALEK ARTISAN · OUTILS PROFESSIONNELS</p><h1 className="mt-4 text-4xl font-black sm:text-5xl">Gérez vos documents en confiance.</h1><p className="mt-4 max-w-3xl text-blue-100">OCR des dépenses, contrôle des mentions, documents français, relances et devis à signer. Vos décisions restent sous votre contrôle.</p><Link href="/deshboard" className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#143770]">← Retour à mes devis et factures</Link></div></section>
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" role="tablist" aria-label="Outils professionnels">{tabs.map(t=><button key={t.key} role="tab" aria-selected={tab===t.key} onClick={()=>{setTab(t.key);setMessage("");if(t.key==="signature")void refreshSignatures();}} className={"rounded-2xl border px-4 py-4 text-left text-sm font-bold shadow-sm transition "+(tab===t.key?"border-blue-700 bg-blue-700 text-white":"border-blue-100 bg-white text-blue-900 hover:border-blue-400")}><span className="mr-2 text-lg">{t.icon}</span>{t.name}</button>)}</div>
      {message&&<div role="status" className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{message}</div>}
      {tab==="scanner"&&<section className="grid gap-6 lg:grid-cols-2">
        <article className="space-y-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-black">Scanner une facture fournisseur</h2><p className="text-sm leading-6 text-slate-600">Prenez une photo d'un ticket ou d'une facture. L'IA extrait les champs ; vous les corrigez puis vous enregistrez la dépense. Elle n'est jamais ajoutée à une facture de vente.</p>
          <Field title="Photo JPEG, PNG, WEBP (4 Mo max.)"><input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{setScanFile(e.target.files?.[0]||null);setScan(null);}}/></Field>
          <button className={primary} disabled={!scanFile||busy||!userId} onClick={()=>void scanReceipt()}>{busy?"Analyse en cours…":"Analyser le justificatif avec l'IA"}</button>
          <p className="text-xs text-slate-500">La photo est transmise au fournisseur d'IA pour analyse et n'est pas conservée par ALEK. N'envoyez pas de justificatif contenant des données inutiles ou hautement sensibles. Une génération IA est décomptée selon l'offre.</p>
          {scan&&<div className="space-y-4 border-t pt-5"><h3 className="text-lg font-black">Vérifier les informations extraites</h3><p className="text-sm text-amber-700">Fiabilité estimée : {Math.round(scan.confidence*100)} % · Ne jamais valider sans comparer à l'original.</p>
            <Field title="Fournisseur"><input className={inputClass} value={scan.merchant} onChange={e=>editScan("merchant",e.target.value)}/></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field title="Date"><input className={inputClass} type="date" value={scan.date} onChange={e=>editScan("date",e.target.value)}/></Field><Field title="Numéro de pièce"><input className={inputClass} value={scan.invoice_number} onChange={e=>editScan("invoice_number",e.target.value)}/></Field></div>
            <div className="grid gap-3 sm:grid-cols-3">{([["total_ttc","Total TTC"],["total_ht","Total HT"],["vat","TVA"]] as const).map(([key,label])=><Field key={key} title={label}><input className={inputClass} type="number" min="0" step=".01" value={scan[key]??""} onChange={e=>editScan(key,e.target.value)}/></Field>)}</div>
            <Field title="Catégorie"><select className={inputClass} value={scan.category} onChange={e=>editScan("category",e.target.value)}>{categories.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></Field>
            <Field title="Description"><input className={inputClass} value={scan.description} onChange={e=>editScan("description",e.target.value)}/></Field>
            <button className={primary} disabled={busy} onClick={()=>void saveExpense()}>Valider et enregistrer cette dépense</button>
          </div>}
        </article>
        <article className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-black">Registre de dépenses</h2><p className="mt-3 text-sm text-slate-600">Historique privé. Vérifiez la récupération et la déductibilité de TVA avec votre comptable.</p><div className="mt-5 text-3xl font-black text-blue-700">{money(expenses.reduce((sum,item)=>sum+Number(item.total_ttc||0),0))}</div><p className="text-xs text-slate-500">Total TTC des {expenses.length} dernières dépenses chargées</p><div className="mt-6 space-y-3">{expenses.length===0?<p className="text-sm text-slate-400">Aucune dépense enregistrée.</p>:expenses.map(e=><div key={e.id} className="rounded-xl border border-slate-100 p-4"><div className="flex justify-between gap-3"><strong>{e.merchant}</strong><strong>{money(e.total_ttc)}</strong></div><p className="mt-1 text-xs text-slate-500">{e.document_date||"Date inconnue"} · {categories.find(c=>c[0]===e.category)?.[1]||e.category} · {e.invoice_number||"Sans référence"}</p></div>)}</div></article>
      </section>}
      {tab==="conformite"&&<section className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]"><article className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Contrôle des mentions</h2><p className="text-sm text-slate-600">Choisissez un document : les champs connus sont contrôlés automatiquement.</p>{docSelector}<Field title="Type de client"><select className={inputClass} value={clientKind} onChange={e=>setClientKind(e.target.value as ClientKind)}><option value="professionnel">Professionnel (B2B)</option><option value="particulier">Particulier (B2C)</option></select></Field><Field title="SIREN du client professionnel"><input className={inputClass} value={clientSiren} onChange={e=>setClientSiren(e.target.value.replace(/\D/g,"").slice(0,9))} placeholder="9 chiffres"/></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={vatExempt} onChange={e=>setVatExempt(e.target.checked)}/> Franchise en base de TVA (à confirmer)</label><Field title="Secteur"><select className={inputClass} value={sector} onChange={e=>setSector(e.target.value)}><option value="">Général</option><option value="batiment">Bâtiment / artisanat</option></select></Field><p className="text-xs text-slate-500">Contrôle indicatif : ne couvre pas toutes les activités, taux de TVA, garanties et cas particuliers.</p></article>
        <article className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Résultats</h2>{!selectedDoc?<p className="mt-5 text-slate-500">Enregistrez d'abord un devis ou une facture dans votre espace.</p>:<><p className="mt-2 text-sm text-slate-600">{selectedDoc.document_number||"Document"} · {checks.filter(f=>f.level==="important").length} point(s) important(s), {checks.filter(f=>f.level==="attention").length} vérification(s).</p><div className="mt-5 space-y-3">{checks.length?checks.map((f,i)=><div className={"rounded-xl border p-4 "+(f.level==="important"?"border-red-100 bg-red-50":"border-amber-100 bg-amber-50")} key={i}><p className="text-sm font-semibold">{f.level==="important"?"À corriger : ":"À vérifier : "}{f.message}</p><a className="mt-2 inline-block text-xs font-bold text-blue-700 underline" href={f.reference} target="_blank" rel="noreferrer">Source officielle</a></div>):<p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Aucun élément détecté par ce contrôle limité. Cela ne constitue pas une certification légale.</p>}</div><div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4"><strong>Clauses suggérées (à adapter)</strong><pre className="mt-3 whitespace-pre-wrap font-sans text-sm">{paymentClauses(clientKind,30,vatExempt).join("\n")}</pre><button className={secondary} onClick={()=>void navigator.clipboard.writeText(paymentClauses(clientKind,30,vatExempt).join("\n"))}>Copier les clauses</button></div></>}</article>
      </section>}
      {tab==="modeles"&&<section className="grid gap-6 lg:grid-cols-2"><article className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Créer un document en français</h2><Field title="Modèle"><select className={inputClass} value={templateKind} onChange={e=>setTemplateKind(e.target.value as TemplateKind)}><option value="contrat">Contrat de prestation de services</option><option value="offre">Proposition commerciale</option><option value="acceptation">Bon pour accord</option><option value="cgv">Conditions générales de vente</option></select></Field>{docSelector}<button className={secondary} onClick={fillTemplateFromDocument} disabled={!selectedDoc}>Préremplir depuis le document sélectionné</button>
        {([["provider","Émetteur"],["providerAddress","Adresse de l'entreprise"],["providerSiret","SIRET / SIREN"],["client","Client"],["clientAddress","Adresse du client"],["description","Prestations / objet"],["amount","Montant et TVA"],["deadline","Dates / délais"]] as const).map(([key,label])=><Field key={key} title={label}><input className={inputClass} value={templateInfo[key]} onChange={e=>setTemplateInfo(v=>({...v,[key]:e.target.value}))}/></Field>)}
        <Field title="Nature du client"><select className={inputClass} value={clientKind} onChange={e=>setClientKind(e.target.value as ClientKind)}><option value="professionnel">Professionnel</option><option value="particulier">Particulier</option></select></Field></article>
        <article className="rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Aperçu éditable</h2><p className="mt-2 text-sm text-slate-600">Brouillon à compléter et à faire valider selon votre secteur. Pas de garantie d'exhaustivité juridique.</p><textarea className={inputClass+" mt-5 min-h-[540px] resize-y font-mono leading-6"} value={template} readOnly/><div className="mt-5 flex flex-wrap gap-3"><button className={primary} onClick={()=>void navigator.clipboard.writeText(template)}>Copier le modèle</button><button className={secondary} onClick={()=>downloadText(template,"ALEK-"+templateKind+".txt")}>Télécharger TXT</button></div></article>
      </section>}
      {tab==="relances"&&<section className="grid gap-6 lg:grid-cols-2"><article className="space-y-5 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Préparer une relance</h2>{docSelector}<Field title="Type de message"><select className={inputClass} value={relanceKind} onChange={e=>setRelanceKind(e.target.value as typeof relanceKind)}><option value="devis">Envoi du devis</option><option value="avant">Avant échéance de la facture</option><option value="retard">Facture impayée</option></select></Field><p className="text-sm text-slate-600">Les messages ne sont pas envoyés automatiquement. Vous vérifiez et déclenchez personnellement l'envoi.</p><p className="text-xs text-slate-500">N'envoyez des messages qu'aux personnes concernées par une relation contractuelle réelle. L'automatisation SMS/WhatsApp requiert un fournisseur et des autorisations adaptés.</p></article>
        <article className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Message en français</h2><Field title="Objet"><input className={inputClass} readOnly value={relance.subject}/></Field><textarea className={inputClass+" min-h-[250px]"} readOnly value={relance.body}/><div className="flex flex-wrap gap-3"><button className={secondary} onClick={()=>void navigator.clipboard.writeText(relance.subject+"\n\n"+relance.body)}>Copier</button>{selectedDoc?.client_email&&<a className={primary} href={"mailto:"+encodeURIComponent(selectedDoc.client_email)+"?subject="+encodeURIComponent(relance.subject)+"&body="+encodeURIComponent(relance.body)}>Ouvrir l'e-mail</a>}{selectedDoc?.client_phone&&<a className={secondary} target="_blank" rel="noreferrer" href={"https://wa.me/"+selectedDoc.client_phone.replace(/\D/g,"")+"?text="+encodeURIComponent(relance.body)}>Ouvrir WhatsApp</a>}</div>{selectedDoc&&!selectedDoc.client_email&&<p className="text-sm text-amber-700">Aucune adresse e-mail enregistrée pour ce client.</p>}</article>
      </section>}
      {tab==="signature"&&<section className="grid gap-6 lg:grid-cols-2"><article className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Faire signer un devis</h2><p className="text-sm leading-6 text-slate-600">Créez un lien personnel pour qu'un client consulte le devis enregistré et le signe au doigt ou à la souris. Le contenu original est figé et une preuve SHA-256 est enregistrée.</p>{docSelector}{selectedDoc?.document_type==="facture"&&<p className="text-sm text-amber-700">Sélectionnez un devis plutôt qu'une facture.</p>}<button className={primary} onClick={()=>void createSignatureLink()} disabled={!selectedDoc||selectedDoc.document_type!=="devis"||busy}>{busy?"Création…":"Créer le lien de signature (14 jours)"}</button><p className="text-xs text-slate-500">Signature simple, sans contrôle d'identité fort ni certification qualifiée eIDAS. Pour contrats sensibles, utiliser une signature avancée ou qualifiée adaptée.</p></article>
        <article className="space-y-4 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">Lien sécurisé</h2><button className={secondary} onClick={()=>void refreshSignatures()}>Actualiser les signatures</button><div className="space-y-2">{signatureRequests.map(req=><div key={req.id} className="rounded-xl border border-slate-200 p-3 text-sm"><strong>{documents.find(d=>d.id===req.document_id)?.document_number||"Devis"}</strong><p className={req.status==="signed"?"font-semibold text-emerald-700":"text-slate-600"}>{req.status==="signed"?"Signé par "+(req.signer_name||""):"En attente de signature"} · {req.signed_at||req.created_at}</p>{req.signature_sha256&&<p className="mt-1 break-all text-xs text-slate-500">Empreinte preuve : {req.signature_sha256}</p>}</div>)}</div>{signatureLink?<><textarea readOnly className={inputClass+" min-h-[100px] break-all"} value={signatureLink}/><button className={secondary} onClick={()=>void navigator.clipboard.writeText(signatureLink)}>Copier le lien</button>{selectedDoc?.client_email&&<a className={primary} href={"mailto:"+encodeURIComponent(selectedDoc.client_email)+"?subject="+encodeURIComponent("Signature de votre devis "+selectedDoc.document_number)+"&body="+encodeURIComponent("Bonjour,\n\nVeuillez consulter et, si vous acceptez les termes, signer votre devis via ce lien personnel :\n"+signatureLink+"\n\nCordialement,\n"+selectedDoc.business_name)}>Envoyer via votre messagerie</a>}<p className="text-sm text-amber-800">Toute personne disposant de ce lien peut signer. Vérifiez l'identité du destinataire par un autre canal.</p></>:<p className="text-sm text-slate-500">Le lien apparaîtra ici après la création.</p>}</article>
      </section>}
      <p className="mt-9 text-center text-xs text-slate-500">Outils d'assistance — ne remplacent ni un expert-comptable ni un juriste. Les factures PDF ordinaires ne remplacent pas l'e-facturation via plateforme agréée.</p>
    </div>
  </main>;
}
