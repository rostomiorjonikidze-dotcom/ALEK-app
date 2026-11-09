"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { authErrorMessage, initializeRecoverySession, passwordIsStrong, recoveryLinkMessage, updateAccountPassword } from "../lib/auth";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("Vérification du lien de récupération…");
  const [recoveryValidated, setRecoveryValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const auth = supabase.auth;
        const { data: { subscription } } = auth.onAuthStateChange((event) => {
          if (active && event === "SIGNED_OUT") {
            setRecoveryValidated(false);
            setMessage(recoveryLinkMessage);
          }
        });
        unsubscribe = () => subscription.unsubscribe();
        const session = await initializeRecoverySession(auth, window.location.href);
        if (active) {
          setRecoveryValidated(Boolean(session));
          setMessage(session ? "" : recoveryLinkMessage);
        }
      } catch (error) {
        if (active) { setRecoveryValidated(false); setMessage(authErrorMessage(error)); }
      }
    })();
    return () => { active = false; unsubscribe?.(); };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (loading || saved) return;
    if (!recoveryValidated) { setMessage(recoveryLinkMessage); return; }
    if (!passwordIsStrong(password)) {
      setMessage("10 caractères minimum, avec majuscule, minuscule, chiffre et symbole.");
      return;
    }
    if (password !== confirm) { setMessage("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      await updateAccountPassword(supabase.auth, password);
      setSaved(true);
      setPassword("");
      setConfirm("");
      setMessage("Mot de passe modifié. Vous pouvez accéder à votre espace.");
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally { setLoading(false); }
  }

  const inputStyle = { padding: 12, border: "1px solid #ccc", borderRadius: 8, width: "100%", minWidth: 0 };
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#102a51", padding: 20 }}>
      <form onSubmit={save} style={{ width: "100%", maxWidth: 420, padding: 30, background: "white", color: "#102a51", borderRadius: 20, display: "grid", gap: 14 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>ALEK — Nouveau mot de passe</h1>
        {!saved && <>
          <label htmlFor="new-password">Nouveau mot de passe</label>
          <input id="new-password" type={visible ? "text" : "password"} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} disabled={!recoveryValidated || loading} aria-describedby="password-help" style={inputStyle} />
          <p id="password-help">10 caractères minimum, avec majuscule, minuscule, chiffre et symbole.</p>
          <label htmlFor="confirm-password">Confirmer le mot de passe</label>
          <input id="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required disabled={!recoveryValidated || loading} style={inputStyle} />
          <label><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> Afficher le mot de passe</label>
          <button disabled={loading || !recoveryValidated} style={{ background: "#1677ff", color: "white", padding: 12, borderRadius: 8 }}>{loading ? "Veuillez patienter..." : "Enregistrer le mot de passe"}</button>
        </>}
        {message && <p role="status">{message}</p>}
        {saved ? <Link href="/dashboard">Accéder à mon espace</Link> : <Link href="/login">Retour à la connexion</Link>}
      </form>
    </main>
  );
}
