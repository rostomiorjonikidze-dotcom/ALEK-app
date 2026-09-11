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


export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-stone-900">
      <section className="mx-auto max-w-2xl rounded-3xl border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
        <a href="/pricing" className="text-sm font-semibold text-amber-700">← Retour à ALEK</a>
        <h1 className="mt-5 text-3xl font-black">Contact</h1>
        <p className="mt-4 leading-7 text-stone-700">Une question sur ALEK, votre compte, votre abonnement ou vos données ? Contactez-nous par e-mail.</p>
        <div className="mt-7 rounded-2xl bg-amber-50 p-5">
          <p className="text-sm font-semibold text-stone-600">E-mail de support</p>
          <a className="mt-2 block text-xl font-bold text-amber-800 underline" href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
        </div>
        <p className="mt-6 text-sm leading-6 text-stone-600">Pour une demande concernant un paiement Paddle, indiquez si possible l’adresse e-mail utilisée lors de l’achat et la référence de transaction. N’envoyez jamais votre numéro complet de carte bancaire.</p>
        <Footer />
      </section>
    </main>
  );
}
