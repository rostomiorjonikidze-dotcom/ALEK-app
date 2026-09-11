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
          <a key={link.href} href={link.href} className="hover:text-amber-700">
            {link.label}
          </a>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} ALEK. Tous droits réservés.
      </p>
    </footer>
  );
}


export default function LegalNoticePage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-stone-900">
      <article className="mx-auto max-w-3xl rounded-3xl border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
        <a href="/pricing" className="text-sm font-semibold text-amber-700">← Retour à ALEK</a>
        <h1 className="mt-5 text-3xl font-black">Mentions légales</h1>
        <p className="mt-2 text-sm text-stone-500">Dernière mise à jour : {LEGAL.updatedAt}</p>
        <div className="mt-8 space-y-6 leading-7 text-stone-700">
          <section><h2 className="text-xl font-bold text-stone-900">Éditeur</h2>
            <p className="mt-2">Nom / identité légale : {LEGAL.legalName}</p>
            <p>Marque / service : ALEK</p>
            <p>Adresse : {LEGAL.postalAddress}</p>
            <p>E-mail : {LEGAL.supportEmail}</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">Hébergement</h2>
            <p className="mt-2">L’application ALEK est destinée à être hébergée sur une infrastructure cloud sécurisée. Les informations exactes de l’hébergeur de production doivent être renseignées ici avant la mise en ligne publique définitive.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">Propriété intellectuelle</h2>
            <p className="mt-2">La marque ALEK, le logo, l’interface et les contenus propres du service sont protégés par les droits applicables. Toute reproduction non autorisée est interdite sauf exception légale.</p>
          </section>
        </div>
        <Footer />
      </article>
    </main>
  );
}
