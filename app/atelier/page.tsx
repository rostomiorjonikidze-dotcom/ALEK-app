"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "../lib/supabase";
import {userFacingError} from "../lib/user-facing-error";

type Client={id:string;name:string;email:string|null;phone:string|null;address:string|null};
type Item={id:string;name:string;unit:string;unit_price:number};
type AccessState="loading"|"signed-out"|"auth-error"|"ready";

export default function ArtisanWorkspace(){
 const [userId,setUserId]=useState("");
 const [clients,setClients]=useState<Client[]>([]);
 const [items,setItems]=useState<Item[]>([]);
 const [tab,setTab]=useState<"clients"|"catalogue">("clients");
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [phone,setPhone]=useState("");
 const [price,setPrice]=useState("");
 const [unit,setUnit]=useState("unité");
 const [notice,setNotice]=useState("");
 const [access,setAccess]=useState<AccessState>("loading");
 const [busy,setBusy]=useState("");

 async function load(id:string){
  try {
   const [clientResult,itemResult]=await Promise.all([
    supabase.from("artisan_clients").select("id,name,email,phone,address").eq("user_id",id).order("created_at",{ascending:false}),
    supabase.from("artisan_catalog").select("id,name,unit,unit_price").eq("user_id",id).order("created_at",{ascending:false}),
   ]);
   if(clientResult.error||itemResult.error){setNotice(userFacingError("load"));return false;}
   setClients(clientResult.data||[]);
   setItems(itemResult.data||[]);
   setNotice("");
   return true;
  } catch {
   setNotice(userFacingError("load"));
   return false;
  }
 }

 useEffect(()=>{
  let active=true;
  void (async()=>{
   try {
    const {data,error}=await supabase.auth.getUser();
    if(!active)return;
    if(error){setAccess("auth-error");setNotice(userFacingError("auth"));return;}
    if(!data.user){setAccess("signed-out");return;}
    setUserId(data.user.id);
    await load(data.user.id);
    if(active)setAccess("ready");
   } catch {
    if(active){setAccess("auth-error");setNotice(userFacingError("auth"));}
   }
  })();
  return()=>{active=false;};
 },[]);

 async function add(){
  if(access!=="ready"||!userId||!name.trim()||busy)return;
  setNotice("");setBusy("save");
  try {
   const result=tab==="clients"
    ? await supabase.from("artisan_clients").insert({user_id:userId,name:name.trim(),email:email.trim()||null,phone:phone.trim()||null})
    : await supabase.from("artisan_catalog").insert({user_id:userId,name:name.trim(),unit,unit_price:Number(price)||0});
   if(result.error){setNotice(userFacingError("save"));return;}
   setName("");setEmail("");setPhone("");setPrice("");
   await load(userId);
  } catch {
   setNotice(userFacingError("save"));
  } finally {
   setBusy("");
  }
 }

 async function remove(id:string){
  if(access!=="ready"||!userId||busy)return;
  setNotice("");setBusy(id);
  try {
   const result=await supabase.from(tab==="clients"?"artisan_clients":"artisan_catalog").delete().eq("id",id).eq("user_id",userId);
   if(result.error){setNotice(userFacingError("delete"));return;}
   await load(userId);
  } catch {
   setNotice(userFacingError("delete"));
  } finally {
   setBusy("");
  }
 }

 const input="w-full rounded-xl border border-slate-300 bg-white px-4 py-3";
 return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><div className="mx-auto max-w-4xl"><Link href="/dashboard" className="text-blue-700">← Mon espace</Link><h1 className="mt-5 text-3xl font-bold">ALEK · Mes clients et tarifs</h1><p className="mt-2 text-slate-600">Vos données sont privées et liées à votre compte.</p>
  {notice&&<p role="alert" className="mt-4 text-red-700">{notice}</p>}
  {access==="loading"&&<p role="status" className="mt-5 text-slate-600">Chargement de vos données…</p>}
  {(access==="signed-out"||access==="auth-error")&&<p className="mt-5">Connectez-vous pour accéder à vos données. <Link href="/login" className="text-blue-700 underline">Connexion</Link></p>}
  {access==="ready"&&<><div className="mt-6 flex gap-2"><button onClick={()=>setTab("clients")} className={"rounded-xl px-5 py-3 "+(tab==="clients"?"bg-blue-700 text-white":"bg-white")}>Clients ({clients.length})</button><button onClick={()=>setTab("catalogue")} className={"rounded-xl px-5 py-3 "+(tab==="catalogue"?"bg-blue-700 text-white":"bg-white")}>Matériaux & services ({items.length})</button></div><section className="mt-5 rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Ajouter {tab==="clients"?"un client":"un article"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><input className={input} aria-label={tab==="clients"?"Nom du client":"Nom du matériau ou service"} placeholder={tab==="clients"?"Nom du client":"Nom du matériau / service"} value={name} onChange={e=>setName(e.target.value)} maxLength={180}/>{tab==="clients"?<><input className={input} aria-label="E-mail du client" placeholder="E-mail" type="email" value={email} onChange={e=>setEmail(e.target.value)}/><input className={input} aria-label="Téléphone du client" placeholder="Téléphone" value={phone} onChange={e=>setPhone(e.target.value)}/></>:<><input className={input} aria-label="Prix hors taxes" type="number" min="0" step=".01" placeholder="Prix HT (€)" value={price} onChange={e=>setPrice(e.target.value)}/><select className={input} aria-label="Unité de facturation" value={unit} onChange={e=>setUnit(e.target.value)}><option>unité</option><option>heure</option><option>m²</option><option>mètre</option><option>forfait</option></select></>}</div><button onClick={()=>void add()} disabled={!name.trim()||!!busy} className="mt-4 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{busy==="save"?"Enregistrement…":"Enregistrer"}</button></section><section className="mt-5 space-y-3">{tab==="clients"?clients.map(x=><article key={x.id} className="flex justify-between gap-3 rounded-xl bg-white p-4"><div><strong>{x.name}</strong><p className="text-sm text-slate-600">{x.email||""} {x.phone||""}</p></div><button disabled={!!busy} onClick={()=>void remove(x.id)} className="text-red-700 disabled:opacity-50">{busy===x.id?"Suppression…":"Supprimer"}</button></article>):items.map(x=><article key={x.id} className="flex justify-between gap-3 rounded-xl bg-white p-4"><div><strong>{x.name}</strong><p className="text-sm text-slate-600">{Number(x.unit_price).toLocaleString("fr-FR",{minimumFractionDigits:2})} € / {x.unit}</p></div><button disabled={!!busy} onClick={()=>void remove(x.id)} className="text-red-700 disabled:opacity-50">{busy===x.id?"Suppression…":"Supprimer"}</button></article>)}</section></>}
 </div></main>;
}
