"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { supabase } from "../lib/supabase";

import {
  authErrorMessage,
  initializeAuthCallbackSession,
  isAuthCallbackUrl,
  passwordIsStrong,
  registerWithEmailConfirmation,
  requestPasswordRecovery,
  signInWithEmailAndPassword,
  signupConfirmationMessage,
} from "../lib/auth";

type Mode = "login" | "signup";

const texts = {

  fr: {
    login: "Connexion",
    signup: "Inscription",
    subtitleLogin: "Connectez-vous à votre compte ALEK",
    subtitleSignup: "Créez votre compte professionnel ALEK",

    firstName: "Prénom",
    lastName: "Nom",
    company: "Nom de l’entreprise",
    siret: "SIRET / SIREN",
    email: "E-mail",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",

    loginButton: "Se connecter",
    signupButton: "Créer mon compte",
    loading: "Veuillez patienter...",

    noAccount: "Pas encore de compte ? S’inscrire",
    hasAccount: "Vous avez déjà un compte ? Se connecter",

    required: "Veuillez remplir tous les champs obligatoires.",
    invalidSiret: "Le SIRET doit contenir 14 chiffres ou le SIREN 9 chiffres.",
    shortPassword: "Le mot de passe doit contenir au moins 10 caractères.",
    weakPassword:
      "Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.",
    passwordsMismatch: "Les mots de passe ne correspondent pas.",
    captchaRequired: "Veuillez compléter la vérification CAPTCHA.",
    signupSuccess: signupConfirmationMessage,
    accountReady: "Votre compte est prêt. Connectez-vous.",
    privacy:
      "En vous inscrivant, vous confirmez que les informations professionnelles fournies sont exactes.",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const captchaRef = useRef<HCaptcha>(null);

  const [mode, setMode] = useState<Mode>("login");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [siret, setSiret] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [captchaToken, setCaptchaToken] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!isAuthCallbackUrl(window.location.href)) return;
    let active = true;
    void (async () => {
      try {
        const session = await initializeAuthCallbackSession(supabase.auth, window.location.href);
        if (active && session) { router.replace("/dashboard"); router.refresh(); }
        else if (active) setMessage("Connectez-vous pour accéder à votre espace.");
      } catch (error) { if (active) setMessage(authErrorMessage(error)); }
    })();
    return () => { active = false; };
  }, [router]);

  const t = texts.fr;
  const recoveryLabels = [
    "Mot de passe oublié ?",
    "Réinitialiser le mot de passe",
    "Si cette adresse est enregistrée, un lien de réinitialisation sera envoyé. Vérifiez aussi les spams.",
    "Retour à la connexion",
    "Envoyer le lien de réinitialisation",
    "Afficher le mot de passe",
  ];
  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";
  const captchaEnabled = Boolean(captchaSiteKey);

  function normalizeSiret(value: string) {
    return value.replace(/\D/g, "").slice(0, 14);
  }

  async function handleRecovery() {
    setMessage("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) { setMessage(t.required); return; }
    if (captchaEnabled && !captchaToken) { setMessage(t.captchaRequired); return; }
    setLoading(true);
    try {
      await requestPasswordRecovery(
        supabase.auth,
        cleanEmail,
        new URL("/reset-password", window.location.origin).toString(),
        captchaEnabled ? captchaToken : undefined,
      );
      setMessage(recoveryLabels[2]);
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { setLoading(false); captchaRef.current?.resetCaptcha(); setCaptchaToken(""); }
  }

  async function handleSubmit() {
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanSiret = normalizeSiret(siret);

    if (mode === "signup") {
      if (
        !firstName.trim() ||
        !lastName.trim() ||
        !companyName.trim() ||
        !cleanSiret ||
        !cleanEmail ||
        !password ||
        !confirmPassword
      ) {
        setMessage(t.required);
        return;
      }

      if (cleanSiret.length !== 9 && cleanSiret.length !== 14) {
        setMessage(t.invalidSiret);
        return;
      }

      if (password.length < 10) {
        setMessage(t.shortPassword);
        return;
      }

      if (!passwordIsStrong(password)) {
        setMessage(t.weakPassword);
        return;
      }

      if (password !== confirmPassword) {
        setMessage(t.passwordsMismatch);
        return;
      }

    }

    if (!cleanEmail || !password) {
      setMessage(t.required);
      return;
    }

    if (captchaEnabled && !captchaToken) { setMessage(t.captchaRequired); return; }
    setLoading(true);

    try {
      if (mode === "signup") {
        const session = await registerWithEmailConfirmation(supabase.auth, {
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            ...(captchaEnabled && captchaToken ? { captchaToken } : {}),
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              company_name: companyName.trim(),
              siret: cleanSiret,
            },
          },
        });

        setMessage(session ? t.accountReady : t.signupSuccess);
        if (session) { router.replace("/dashboard"); router.refresh(); }
      } else {
        await signInWithEmailAndPassword(supabase.auth, {
          email: cleanEmail,
          password,
          options: captchaEnabled ? { captchaToken } : undefined,
        });

        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      captchaRef.current?.resetCaptcha();
      setCaptchaToken("");
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 14px",
    borderRadius: "10px",
    border: "1px solid #d6dce5",
    fontSize: "15px",
    boxSizing: "border-box",
    outline: "none",
    background: "#fff",
  };

  return (
    <main
      dir="ltr"
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 15% 20%, rgba(60,129,246,.35) 0%, transparent 45%), radial-gradient(circle at 95% 80%, rgba(20,183,230,.18) 0%, transparent 40%), linear-gradient(140deg, #07172f, #14376c)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "48px",
        flexWrap: "wrap",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        width: "100%",
      }}
    >
      <section className="hidden max-w-[530px] flex-1 text-white lg:block" aria-label="Présentation ALEK Artisan"><p className="mb-5 text-sm font-bold uppercase tracking-[.25em] text-blue-200">ALEK Artisan</p><h1 className="text-5xl font-black leading-[1.13] tracking-tight">Des devis précis.<br/>Des factures simples.</h1><p className="mt-7 max-w-lg text-lg leading-8 text-blue-100">Votre espace professionnel pour préparer vos devis, gérer vos factures et retrouver vos documents, avec une assistance IA en français.</p><div className="mt-9 grid grid-cols-2 gap-4"><div className="rounded-[24px] border border-white/20 bg-white/10 p-6 shadow-xl shadow-black/10 backdrop-blur-xl"><p className="text-3xl font-black">01</p><p className="mt-2 text-sm text-blue-100">Décrivez votre prestation</p></div><div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur"><p className="text-3xl font-black">02</p><p className="mt-2 text-sm text-blue-100">Préparez votre document</p></div></div><p className="mt-8 text-sm text-blue-200">Devis · Factures · PDF · Assistant IA</p></section>
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "rgba(255,255,255,.98)",
          border: "1px solid rgba(255,255,255,.6)",
          borderRadius: "32px",
          padding: "clamp(22px, 4vw, 40px)",
          boxShadow: "0 35px 110px rgba(0, 11, 37, 0.36)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "30px",
                fontWeight: 800,
                letterSpacing: "1px",
                color: "#1267c4",
              }}
            >
              ALEK
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#7a8595",
                marginTop: "3px",
              }}
            >
              DEVIS • FACTURES • IA
            </div>
          </div>

          <span lang="fr" className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">Français</span>
        </div>

        <h1
          style={{
            fontSize: "24px",
            margin: "0 0 6px",
          }}
        >
          {recoveryMode ? recoveryLabels[1] : mode === "login" ? t.login : t.signup}
        </h1>

        <p
          style={{
            color: "#6c7684",
            marginTop: 0,
            marginBottom: "24px",
          }}
        >
          {recoveryMode ? recoveryLabels[1] : mode === "login" ? t.subtitleLogin : t.subtitleSignup}
        </p>

        <form
          onSubmit={(event) => { event.preventDefault(); if (!loading) void (recoveryMode ? handleRecovery() : handleSubmit()); }}
          style={{
            display: "grid",
            gap: "12px",
          }}
        >
          {!recoveryMode && mode === "signup" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <input
                  style={inputStyle}
                  aria-label={t.firstName}
                  required
                  placeholder={t.firstName}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />

                <input
                  style={inputStyle}
                  aria-label={t.lastName}
                  required
                  placeholder={t.lastName}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>

              <input
                style={inputStyle}
                aria-label={t.company}
                required
                placeholder={t.company}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
              />

              <input
                style={inputStyle}
                aria-label={t.siret}
                required
                placeholder={t.siret}
                value={siret}
                inputMode="numeric"
                onChange={(e) => setSiret(normalizeSiret(e.target.value))}
              />
            </>
          )}

          <input
            style={inputStyle}
            type="email"
            aria-label={t.email}
            required
            placeholder={t.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          {!recoveryMode && <div style={{display:"flex",gap:"8px",alignItems:"center"}}><input
            style={{...inputStyle,flex:1,minWidth:0}}
            type={showPassword ? "text" : "password"}
            aria-label={t.password}
            required
            placeholder={t.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          /><button type="button" aria-label={recoveryLabels[5]} onClick={()=>setShowPassword(v=>!v)} style={{border:"1px solid #d6dce5",background:"#fff",borderRadius:"9px",padding:"12px",cursor:"pointer"}}>{showPassword ? "🙈" : "👁️"}</button></div>}

          {!recoveryMode && mode === "signup" && (
            <input
              style={inputStyle}
              type={showConfirmPassword ? "text" : "password"}
              aria-label={t.confirmPassword}
              required
              placeholder={t.confirmPassword}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}

          {!recoveryMode && mode === "signup" && (
            <>
              <div
                style={{
                  fontSize: "12px",
                  lineHeight: 1.5,
                  color: "#657081",
                  background: "#f7f9fc",
                  padding: "10px 12px",
                  borderRadius: "9px",
                }}
              >
                10 caractères minimum : majuscule, minuscule, chiffre et caractère spécial.
              </div>


              <div
                style={{
                  fontSize: "12px",
                  color: "#7a8595",
                  lineHeight: 1.5,
                }}
              >
                {t.privacy}
              </div>
            </>
          )}

          {captchaEnabled && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                minHeight: "80px",
                alignItems: "center",
              }}
            >
              <HCaptcha
                ref={captchaRef}
                sitekey={captchaSiteKey}
                languageOverride="fr"
                size="compact"
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken("")}
                onError={() => setCaptchaToken("")}
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              marginTop: "4px",
              borderRadius: "10px",
              border: "none",
              background: loading ? "#8fb8e8" : "#1677ff",
              color: "white",
              fontWeight: 700,
              fontSize: "15px",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading
              ? t.loading
              : recoveryMode ? recoveryLabels[4] : mode === "login"
              ? t.loginButton
              : t.signupButton}
          </button>

          {message && (
            <div role="status"
              style={{
                marginTop: "5px",
                padding: "11px 12px",
                borderRadius: "9px",
                background: "#f3f6fb",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          )}

          {mode === "login" && !recoveryMode && <button type="button" disabled={loading} onClick={()=>{setMessage("");setCaptchaToken("");captchaRef.current?.resetCaptcha();setRecoveryMode(true);}} style={{border:0,background:"transparent",color:"#1677ff",padding:"9px",cursor:"pointer"}}>{recoveryLabels[0]}</button>}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setCaptchaToken("");
              captchaRef.current?.resetCaptcha();
              if(recoveryMode){setRecoveryMode(false);setMessage("");return;}
              setMessage("");
              setMode(mode === "login" ? "signup" : "login");
            }}
            style={{
              width: "100%",
              marginTop: "5px",
              background: "transparent",
              border: "none",
              color: "#1677ff",
              cursor: "pointer",
              padding: "9px",
              fontSize: "14px",
            }}
          >
            {recoveryMode ? recoveryLabels[3] : mode === "login" ? t.noAccount : t.hasAccount}
          </button>
        </form>
      </div>
    </main>
  );
}