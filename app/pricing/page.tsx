"use client";

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


export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff8f0] via-[#fffdf9] to-[#f8efe5] px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[30px] border border-orange-100 bg-[#fffdf9]/95 p-7 shadow-[0_18px_50px_rgba(120,72,24,0.10)]">
          <div className="flex items-center gap-4">
            <img src="/alek-logo.png" alt="ALEK" className="h-14 w-14 rounded-2xl object-cover" />
            <div>
              <p className="text-3xl font-black tracking-wide">ALEK</p>
              <p className="mt-1 text-stone-600">Devis et factures professionnels en français, à partir de votre propre langue.</p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl leading-7 text-stone-700">
            ALEK est un service SaaS destiné aux professionnels qui souhaitent transformer une description de travail,
            de produit ou de service en texte professionnel français, puis créer des devis et factures structurés.
          </p>
        </header>

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            ["Gratuit", "0 €", "3 générations IA / mois", "Devis et factures illimités"],
            ["Pro", "9,99 € / mois", "10 générations IA / mois", "Devis et factures illimités"],
            ["Business", "19,99 € / mois", "IA illimitée", "Devis et factures illimités"],
          ].map(([name, price, ai, docs]) => (
            <article key={name} className={`rounded-3xl border p-6 ${name === "Pro" ? "border-amber-400 bg-amber-50/70 shadow-[0_12px_30px_rgba(217,119,6,0.12)]" : "border-orange-100 bg-[#fffdf9]"}`}>
              <h2 className="text-xl font-bold">{name}</h2>
              <p className="mt-3 text-3xl font-black">{price}</p>
              <p className="mt-5 text-sm text-stone-700">✓ {ai}</p>
              <p className="mt-2 text-sm text-stone-700">✓ {docs}</p>
              <p className="mt-2 text-sm text-stone-700">✓ Création de PDF</p>
              <p className="mt-2 text-sm text-stone-700">✓ Historique des documents</p>
            </article>
          ))}
        </section>

        <section className="mt-7 rounded-3xl border border-orange-100 bg-[#fffdf9] p-7">
          <h2 className="text-2xl font-bold">Fonctionnalités principales</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <p>✨ Assistant IA pour reformuler en français professionnel</p>
            <p>📄 Création de devis</p>
            <p>🧾 Création de factures</p>
            <p>🏢 Recherche SIRET / SIREN</p>
            <p>📥 Export PDF</p>
            <p>🕘 Historique des documents</p>
            <p>🌍 Interface multilingue</p>
            <p>🔐 Compte utilisateur sécurisé</p>
          </div>
        </section>

        <section className="mt-7 rounded-3xl border border-orange-100 bg-[#fffdf9] p-7">
          <h2 className="text-2xl font-bold">Abonnements et paiement</h2>
          <p className="mt-4 leading-7 text-stone-700">
            Les abonnements payants sont mensuels et se renouvellent automatiquement jusqu’à leur résiliation.
            Lorsque les paiements en direct seront activés, Paddle agira comme Merchant of Record pour le traitement
            des paiements, taxes applicables, reçus et gestion des transactions.
          </p>
          <p className="mt-3 text-sm text-stone-600">
            Vous pouvez consulter les règles d’annulation et de remboursement sur notre page dédiée.
          </p>
        </section>

        <section className="mt-7 rounded-3xl border border-orange-100 bg-[#fffdf9] p-7">
          <h2 className="text-2xl font-bold">Besoin d’aide ?</h2>
          <p className="mt-3 text-stone-700">
            Contact : <a className="font-semibold text-amber-700 underline" href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>
          </p>
        </section>

        <Footer />
      </div>
    </main>
  );
}
