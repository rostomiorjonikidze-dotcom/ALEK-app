"use client";

import { LEGAL } from "../legal-config";
import Link from "next/link";


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
    <footer className="mt-12 border-t border-blue-100 pt-7 text-sm text-slate-600">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-3">
        {legalLinks.map((link) => (
          <a key={link.href} href={link.href} className="hover:text-blue-700">
            {link.label}
          </a>
        ))}
      </div>
      <p className="mt-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} ALEK. Tous droits réservés.
      </p>
    </footer>
  );
}


export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f5f7fc] px-4 py-10 text-[#14213b]">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[30px] border border-white/10 bg-[#101c34] p-7 text-white shadow-[0_18px_50px_rgba(22,55,110,0.10)]">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Accueil ALEK Artisan" className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-600 text-2xl font-black text-white">A</Link>
            <div>
              <p className="text-3xl font-black tracking-wide">ALEK</p>
              <p className="mt-1 text-blue-100">Devis, factures et gestion documentaire pour toutes les entreprises.</p>
            </div>
          </div>
          <nav aria-label="Navigation principale" className="mt-7 flex flex-wrap gap-3 text-sm font-semibold"><Link href="/" className="rounded-xl border border-white/25 px-4 py-2 text-white hover:bg-white/10">Accueil</Link><Link href="/a-propos" className="rounded-xl border border-white/25 px-4 py-2 text-white hover:bg-white/10">À propos</Link><Link href="/login" className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-500">Mon espace →</Link></nav><p className="mt-6 max-w-3xl leading-7 text-slate-200">
            ALEK accompagne les indépendants, artisans, commerces, associations, TPE, PME et grandes entreprises dans la préparation de devis et de factures. Les fonctionnalités avancées destinées aux équipes sont en cours de développement.
          </p>
        </header>

        <section className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Gratuit", "0 €", "3 générations IA / mois", "Devis et factures illimités"],
            ["Pro", "9,99 € / mois", "10 générations IA / mois", "Devis et factures illimités"],
            ["Business", "19,99 € / mois", "IA illimitée", "Devis et factures illimités"],
            ["Entreprise", "Sur devis", "Fonctions multi-utilisateurs à venir", "Contactez-nous pour vos besoins"],
          ].map(([name, price, ai, docs]) => (
            <article key={name} className={`rounded-3xl border p-6 ${name === "Pro" ? "border-blue-500 bg-blue-50 shadow-[0_12px_30px_rgba(37,99,235,0.12)]" : "border-blue-100 bg-white"}`}>
              <h2 className="text-xl font-bold">{name}</h2>
              <p className="mt-3 text-3xl font-black">{price}</p>
              <p className="mt-5 text-sm text-stone-700">✓ {ai}</p>
              <p className="mt-2 text-sm text-stone-700">✓ {docs}</p>
              <p className="mt-2 text-sm text-stone-700">✓ Création de PDF</p>
              <p className="mt-2 text-sm text-stone-700">✓ Historique des documents {name === "Entreprise" ? "(offre à définir)" : ""}</p>
            </article>
          ))}
        </section>

        <section className="mt-7 rounded-3xl border border-blue-100 bg-white p-7">
          <h2 className="text-2xl font-bold">Fonctionnalités principales</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <p>✨ Assistant IA pour structurer les prestations en français</p>
            <p>📄 Création de devis</p>
            <p>🧾 Création de factures</p>
            <p>🏢 Recherche SIRET / SIREN</p>
            <p>📥 Export PDF</p>
            <p>🕘 Historique des documents</p>
            <p>🇫🇷 Interface en français</p>
            <p>🔐 Compte utilisateur sécurisé</p>
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-blue-100 bg-white p-7">
          <h2 className="text-2xl font-bold">Abonnements et paiement</h2>
          <p className="mt-4 leading-7 text-stone-700">
            Les abonnements payants sont mensuels et se renouvellent automatiquement jusqu’à leur résiliation.
            Les modalités de paiement sont précisées lors de la souscription. Les fonctionnalités Entreprise et les intégrations de facturation électronique ne sont pas encore disponibles.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Vous pouvez consulter les règles d’annulation et de remboursement sur notre page dédiée.
          </p>
        </section>

        <section className="mt-7 rounded-3xl border border-blue-100 bg-blue-50 p-7"><h2 className="text-2xl font-bold">Facturation électronique en France</h2><p className="mt-3 leading-7 text-stone-700">La réforme 2026–2027 impose progressivement la réception et l’émission de factures électroniques selon les catégories d’entreprises. Un PDF ordinaire ne constitue pas une facture électronique réglementaire. La connexion à une plateforme agréée et les échanges structurés sont en préparation et ne sont pas encore proposés par ALEK.</p></section>

        <section className="mt-7 rounded-3xl border border-blue-100 bg-white p-7">
          <h2 className="text-2xl font-bold">Besoin d’aide ?</h2>
          <p className="mt-3 text-stone-700">
            Contact : <a className="font-semibold text-blue-700 underline" href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
          </p>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4"><Link href="/login" className="rounded-xl bg-blue-600 px-7 py-4 font-bold text-white hover:bg-blue-700">Commencer gratuitement →</Link><Link href="/" className="rounded-xl border border-blue-200 px-7 py-4 font-bold text-blue-700 hover:bg-blue-50">Retour à l’accueil</Link></div><Footer />
      </div>
    </main>
  );
}
