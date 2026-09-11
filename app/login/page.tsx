"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { supabase } from "../lib/supabase";

type Lang = "ka" | "fr" | "ru" | "de" | "ar";
type Mode = "login" | "signup";

const texts = {
  ka: {
    login: "შესვლა",
    signup: "რეგისტრაცია",
    subtitleLogin: "შედი შენს ALEK ანგარიშში",
    subtitleSignup: "შექმენი პროფესიონალური ALEK ანგარიში",

    firstName: "სახელი",
    lastName: "გვარი",
    company: "კომპანიის სახელი",
    siret: "SIRET / SIREN",
    email: "ელფოსტა",
    password: "პაროლი",
    confirmPassword: "გაიმეორე პაროლი",

    loginButton: "შესვლა",
    signupButton: "ანგარიშის შექმნა",
    loading: "გთხოვ მოიცადო...",

    noAccount: "ანგარიში არ გაქვს? რეგისტრაცია",
    hasAccount: "უკვე გაქვს ანგარიში? შესვლა",

    required: "გთხოვ შეავსე ყველა აუცილებელი ველი.",
    invalidSiret: "SIRET უნდა შეიცავდეს 14 ციფრს ან SIREN 9 ციფრს.",
    shortPassword: "პაროლი უნდა იყოს მინიმუმ 10 სიმბოლო.",
    weakPassword:
      "პაროლი უნდა შეიცავდეს დიდ ასოს, პატარა ასოს, ციფრს და სპეციალურ სიმბოლოს.",
    passwordsMismatch: "პაროლები ერთმანეთს არ ემთხვევა.",
    captchaRequired: "გთხოვ გაიარე CAPTCHA შემოწმება.",
    signupSuccess:
      "რეგისტრაცია წარმატებულია. შეამოწმე ელფოსტა ანგარიშის დასადასტურებლად.",
    privacy:
      "რეგისტრაციით ადასტურებ, რომ მოწოდებული პროფესიული ინფორმაცია სწორია.",
  },

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
    signupSuccess:
      "Inscription réussie. Consultez votre e-mail pour confirmer votre compte.",
    privacy:
      "En vous inscrivant, vous confirmez que les informations professionnelles fournies sont exactes.",
  },

  ru: {
    login: "Войти",
    signup: "Регистрация",
    subtitleLogin: "Войдите в свой аккаунт ALEK",
    subtitleSignup: "Создайте профессиональный аккаунт ALEK",

    firstName: "Имя",
    lastName: "Фамилия",
    company: "Название компании",
    siret: "SIRET / SIREN",
    email: "Электронная почта",
    password: "Пароль",
    confirmPassword: "Повторите пароль",

    loginButton: "Войти",
    signupButton: "Создать аккаунт",
    loading: "Пожалуйста, подождите...",

    noAccount: "Нет аккаунта? Регистрация",
    hasAccount: "Уже есть аккаунт? Войти",

    required: "Заполните все обязательные поля.",
    invalidSiret: "SIRET должен содержать 14 цифр, SIREN — 9 цифр.",
    shortPassword: "Пароль должен содержать минимум 10 символов.",
    weakPassword:
      "Пароль должен содержать заглавную и строчную буквы, цифру и специальный символ.",
    passwordsMismatch: "Пароли не совпадают.",
    captchaRequired: "Пройдите CAPTCHA-проверку.",
    signupSuccess:
      "Регистрация успешна. Проверьте электронную почту для подтверждения аккаунта.",
    privacy:
      "Регистрируясь, вы подтверждаете правильность предоставленной профессиональной информации.",
  },

  de: {
    login: "Anmelden",
    signup: "Registrieren",
    subtitleLogin: "Melden Sie sich bei Ihrem ALEK-Konto an",
    subtitleSignup: "Erstellen Sie Ihr professionelles ALEK-Konto",

    firstName: "Vorname",
    lastName: "Nachname",
    company: "Firmenname",
    siret: "SIRET / SIREN",
    email: "E-Mail",
    password: "Passwort",
    confirmPassword: "Passwort bestätigen",

    loginButton: "Anmelden",
    signupButton: "Konto erstellen",
    loading: "Bitte warten...",

    noAccount: "Noch kein Konto? Registrieren",
    hasAccount: "Bereits registriert? Anmelden",

    required: "Bitte füllen Sie alle Pflichtfelder aus.",
    invalidSiret: "SIRET muss 14 Ziffern oder SIREN 9 Ziffern enthalten.",
    shortPassword: "Das Passwort muss mindestens 10 Zeichen lang sein.",
    weakPassword:
      "Das Passwort muss Groß- und Kleinbuchstaben, eine Zahl und ein Sonderzeichen enthalten.",
    passwordsMismatch: "Die Passwörter stimmen nicht überein.",
    captchaRequired: "Bitte führen Sie die CAPTCHA-Prüfung durch.",
    signupSuccess:
      "Registrierung erfolgreich. Bitte bestätigen Sie Ihr Konto per E-Mail.",
    privacy:
      "Mit der Registrierung bestätigen Sie die Richtigkeit Ihrer Unternehmensangaben.",
  },

  ar: {
    login: "تسجيل الدخول",
    signup: "إنشاء حساب",
    subtitleLogin: "سجّل الدخول إلى حسابك في ALEK",
    subtitleSignup: "أنشئ حساب ALEK المهني الخاص بك",

    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    company: "اسم الشركة",
    siret: "SIRET / SIREN",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",

    loginButton: "تسجيل الدخول",
    signupButton: "إنشاء الحساب",
    loading: "يرجى الانتظار...",

    noAccount: "ليس لديك حساب؟ إنشاء حساب",
    hasAccount: "لديك حساب بالفعل؟ تسجيل الدخول",

    required: "يرجى ملء جميع الحقول المطلوبة.",
    invalidSiret: "يجب أن يحتوي SIRET على 14 رقمًا أو SIREN على 9 أرقام.",
    shortPassword: "يجب أن تتكون كلمة المرور من 10 أحرف على الأقل.",
    weakPassword:
      "يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير ورقم ورمز خاص.",
    passwordsMismatch: "كلمتا المرور غير متطابقتين.",
    captchaRequired: "يرجى إكمال التحقق CAPTCHA.",
    signupSuccess:
      "تم التسجيل بنجاح. تحقق من بريدك الإلكتروني لتأكيد الحساب.",
    privacy:
      "بإنشاء الحساب، فإنك تؤكد أن المعلومات المهنية المقدمة صحيحة.",
  },

};

export default function LoginPage() {
  const router = useRouter();
  const captchaRef = useRef<HCaptcha>(null);

  const [lang, setLang] = useState<Lang>("fr");
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

  const t = texts[lang];
  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";
  const captchaEnabled = Boolean(captchaSiteKey);

  function normalizeSiret(value: string) {
    return value.replace(/\D/g, "").slice(0, 14);
  }

  function passwordIsStrong(value: string) {
    const hasUppercase = /[A-Z]/.test(value);
    const hasLowercase = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);

    return hasUppercase && hasLowercase && hasNumber && hasSpecial;
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

      if (captchaEnabled && !captchaToken) {
        setMessage(t.captchaRequired);
        return;
      }
    }

    if (!cleanEmail || !password) {
      setMessage(t.required);
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            ...(captchaEnabled && captchaToken ? { captchaToken } : {}),
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              company_name: companyName.trim(),
              siret: cleanSiret,
            },
          },
        });

        captchaRef.current?.resetCaptcha();
        setCaptchaToken("");

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage(t.signupSuccess);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        router.push("/");
        router.refresh();
      }
    } finally {
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
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "#f3f6fb",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#ffffff",
          borderRadius: "22px",
          padding: "32px",
          boxShadow: "0 16px 45px rgba(15, 36, 70, 0.12)",
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

          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            style={{
              border: "1px solid #d6dce5",
              borderRadius: "9px",
              padding: "9px",
              background: "#fff",
            }}
          >
            <option value="fr">🇫🇷 FR</option>
            <option value="ka">🇬🇪 KA</option>
            <option value="ru">🇷🇺 RU</option>
            <option value="de">🇩🇪 DE</option>
            <option value="ar">🇸🇦 AR</option>
          </select>
        </div>

        <h1
          style={{
            fontSize: "24px",
            margin: "0 0 6px",
          }}
        >
          {mode === "login" ? t.login : t.signup}
        </h1>

        <p
          style={{
            color: "#6c7684",
            marginTop: 0,
            marginBottom: "24px",
          }}
        >
          {mode === "login" ? t.subtitleLogin : t.subtitleSignup}
        </p>

        <div
          style={{
            display: "grid",
            gap: "12px",
          }}
        >
          {mode === "signup" && (
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
                  placeholder={t.firstName}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />

                <input
                  style={inputStyle}
                  placeholder={t.lastName}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>

              <input
                style={inputStyle}
                placeholder={t.company}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
              />

              <input
                style={inputStyle}
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
            placeholder={t.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <input
            style={inputStyle}
            type="password"
            placeholder={t.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />

          {mode === "signup" && (
            <input
              style={inputStyle}
              type="password"
              placeholder={t.confirmPassword}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          )}

          {mode === "signup" && (
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
                {lang === "fr" &&
                  "Minimum 10 caractères : majuscule, minuscule, chiffre et caractère spécial."}

                {lang === "ka" &&
                  "მინიმუმ 10 სიმბოლო: დიდი ასო, პატარა ასო, ციფრი და სპეციალური სიმბოლო."}

                {lang === "ru" &&
                  "Минимум 10 символов: заглавная и строчная буквы, цифра и специальный символ."}

                {lang === "de" &&
                  "Mindestens 10 Zeichen: Großbuchstabe, Kleinbuchstabe, Zahl und Sonderzeichen."}

                {lang === "ar" &&
                  "10 أحرف على الأقل: حرف كبير، حرف صغير، رقم ورمز خاص."}
              </div>

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
                    onVerify={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken("")}
                    onError={() => setCaptchaToken("")}
                  />
                </div>
              )}

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

          <button
            onClick={handleSubmit}
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
              : mode === "login"
              ? t.loginButton
              : t.signupButton}
          </button>

          {message && (
            <div
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

          <button
            type="button"
            onClick={() => {
              setMessage("");
              setCaptchaToken("");
              captchaRef.current?.resetCaptcha();

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
            {mode === "login" ? t.noAccount : t.hasAccount}
          </button>
        </div>
      </div>
    </main>
  );
}