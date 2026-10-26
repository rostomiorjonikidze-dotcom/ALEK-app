"use client";
import { useEffect, useState } from "react";
export default function InstallApp() {
  const [prompt, setPrompt] = useState<any>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?: boolean}).standalone === true);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (installed) return null;
  const install = async () => {
    if (prompt) { await prompt.prompt(); setPrompt(null); } else setShowHelp(true);
  };
  return <><button type="button" onClick={install} style={{padding:"11px 14px",borderRadius:10,border:"1px solid #1677e8",background:"#e8f3ff",color:"#125bb3",fontWeight:700,cursor:"pointer"}}>Installer l’application</button>{showHelp && <div role="dialog" aria-label="Installation" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9999,display:"grid",placeItems:"center",padding:20}}><div style={{background:"white",padding:24,borderRadius:18,maxWidth:400,color:"#10233f"}}><h2 style={{fontSize:22,fontWeight:800}}>Installer ALEK Artisan</h2><p style={{marginTop:12,lineHeight:1.6}}>Sur iPhone : ouvrez ce site dans Safari, touchez Partager puis « Sur l’écran d’accueil » et « Ajouter ».</p><p style={{marginTop:10,lineHeight:1.6}}>Sur Android : ouvrez le menu du navigateur et choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».</p><button type="button" onClick={()=>setShowHelp(false)} style={{marginTop:16,padding:"10px 18px",background:"#1677e8",color:"white",border:0,borderRadius:10}}>Fermer</button></div></div>}</>;
}
