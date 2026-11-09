"use client";
import { useEffect, useRef, useState } from "react";
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{outcome: "accepted" | "dismissed"}> };
export default function InstallApp() {
 const dialog=useRef<HTMLDialogElement>(null);
 const [deferred,setDeferred]=useState<InstallEvent|null>(null);
 const [help,setHelp]=useState(false);
 useEffect(()=>{if(help)dialog.current?.showModal();},[help]);
 const [installed,setInstalled]=useState(false);
 const [ios,setIos]=useState(false);
 useEffect(()=>{
  const standalone=window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?:boolean}).standalone===true;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Existing dynamic integration; tracked for typed/lifecycle refactor.
  setInstalled(standalone);
  setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
  const onPrompt=(e:Event)=>{e.preventDefault();setDeferred(e as InstallEvent)};
  const onInstalled=()=>{setInstalled(true);setDeferred(null);setHelp(false)};
  window.addEventListener("beforeinstallprompt",onPrompt);
  window.addEventListener("appinstalled",onInstalled);
  return ()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",onInstalled)};
 },[]);
 const closeHelp=()=>{dialog.current?.close();setHelp(false)};
 const install=async()=>{if(deferred){try{await deferred.prompt();await deferred.userChoice;setDeferred(null)}catch{setHelp(true)}}else setHelp(true)};
 if(installed)return null;
 return <><button type="button" onClick={install} aria-label="Installer ALEK Artisan sur votre appareil" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><span aria-hidden="true">↓</span><span>Installer l’app</span></button>
 {help&&<dialog ref={dialog} onClick={e=>{if(e.target===e.currentTarget)closeHelp()}} onClose={()=>setHelp(false)} aria-label="Installer ALEK Artisan" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/65 sm:p-8"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-700">↓</div><h2 className="text-2xl font-black">Installer ALEK Artisan</h2><p className="mt-3 leading-7 text-slate-600">Accédez plus rapidement à vos devis et factures depuis l’écran d’accueil de votre appareil.</p>{ios?<ol className="mt-4 list-inside list-decimal space-y-2 text-sm leading-6"><li>Ouvrez cette page dans <strong>Safari</strong>.</li><li>Appuyez sur <strong>Partager</strong>.</li><li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li></ol>:<ol className="mt-4 list-inside list-decimal space-y-2 text-sm leading-6"><li>Ouvrez cette page dans votre navigateur.</li><li>Ouvrez le menu du navigateur.</li><li>Choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong> si disponible.</li></ol>}<button type="button" autoFocus onClick={closeHelp} className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800">Compris</button></dialog>}</>;
}
