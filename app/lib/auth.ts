import type { SupabaseClient } from "@supabase/supabase-js";

export function authErrorMessage(error: unknown): string {
  const message = typeof error === "string" ? error
    : error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (/invalid login credentials|invalid password|invalid credentials/i.test(message)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message)) return "Veuillez confirmer votre adresse e-mail avant de vous connecter.";
  if (/already registered/i.test(message)) return "Inscription impossible avec ces informations. Vérifiez-les et réessayez.";
  if (/same_password|same password|different from the old/i.test(message)) return "Choisissez un mot de passe différent de l’ancien.";
  if (/password.*(?:weak|short|at least)/i.test(message)) return "Le mot de passe ne respecte pas les critères de sécurité.";
  if (/rate limit|too many requests|security purposes/i.test(message)) return "Trop de tentatives. Réessayez un peu plus tard.";
  if (/invalid email|email address.*invalid/i.test(message)) return "Veuillez saisir une adresse e-mail valide.";
  if (/captcha/i.test(message)) return "La vérification CAPTCHA a échoué. Veuillez la recommencer.";
  if (/expired|invalid.*token|code verifier|flow state|otp/i.test(message)) return "Ce lien est invalide ou expiré. Demandez un nouveau lien et ouvrez-le dans le navigateur utilisé pour la demande.";
  return "Opération impossible. Vérifiez vos informations et réessayez.";
}

export function passwordIsStrong(value: string): boolean {
  return value.length >= 10 && /[A-Z]/.test(value) && /[a-z]/.test(value)
    && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export const recoveryLinkMessage = "Ouvrez le lien de récupération reçu par e-mail dans le navigateur utilisé pour la demande, ou demandez un nouveau lien.";

// The browser client exchanges PKCE codes during initialization; do not exchange twice.
export async function initializeAuthSession(auth: Pick<SupabaseClient["auth"], "initialize" | "getSession">) {
  const initialized = await auth.initialize();
  if (initialized.error) throw initialized.error;
  const { data, error } = await auth.getSession();
  if (error) throw error;
  return data.session;
}
