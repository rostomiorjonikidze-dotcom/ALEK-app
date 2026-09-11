import { LEGAL } from "../legal-config";

const legalLinks = [
  { href: "/pricing", label: "Tarifs" },
  { href: "/terms", label: "Conditions d’utilisation" },
  { href: "/privacy", label: "Confidentialité" },
  { href: "/refund", label: "Remboursements" },
  { href: "/cookies", label: "Cookies" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/contact", label: "Contact" },
];

function Footer() {
  return (
    <footer className="mt-12 border-t border-orange-100 pt-7 text-sm text-stone-600">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-3">
        {legalLinks.map((link) => (
          <a key={link.href} href={link.href} className="hover:text-amber-700">{link.label}</a>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-stone-500">© {new Date().getFullYear()} ALEK. Tous droits réservés.</p>
    </footer>
  );
}

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-stone-900">
      <article className="mx-auto max-w-3xl rounded-3xl border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
        <a href="/pricing" className="text-sm font-semibold text-amber-700">← Retour à ALEK</a>
        <h1 className="mt-5 text-3xl font-black">Cookies et stockage local</h1>
        <p className="mt-2 text-sm text-stone-500">Dernière mise à jour : {LEGAL.updatedAt}</p>
        <div className="mt-8 space-y-7 leading-7 text-stone-700">
          <section><h2 className="text-xl font-bold text-stone-900">1. Technologies utilisées</h2><p className="mt-2">ALEK peut utiliser des cookies strictement nécessaires, des jetons de session et le stockage local du navigateur afin de maintenir votre connexion, enregistrer certaines préférences et conserver temporairement un brouillon.</p></section>
          <section><h2 className="text-xl font-bold text-stone-900">2. Publicité et suivi</h2><p className="mt-2">ALEK n’utilise pas, pour ses fonctions principales, de cookies publicitaires ou de profilage comportemental. Si des outils optionnels de mesure d’audience ou de marketing sont ajoutés ultérieurement, cette page et, si nécessaire, le mécanisme de consentement seront mis à jour avant leur activation.</p></section>
          <section><h2 className="text-xl font-bold text-stone-900">3. Gestion</h2><p className="mt-2">Vous pouvez supprimer ou bloquer les cookies depuis les réglages de votre navigateur. Le blocage des technologies strictement nécessaires peut empêcher certaines fonctions du compte ou de la session de fonctionner correctement.</p></section>
          <section><h2 className="text-xl font-bold text-stone-900">4. Contact</h2><p className="mt-2">Pour toute question relative à la confidentialité ou aux cookies : <a href={`mailto:${LEGAL.supportEmail}`} className="font-semibold text-amber-700 underline">{LEGAL.supportEmail}</a></p></section>
        </div>
        <Footer />
      </article>
    </main>
  );
}
