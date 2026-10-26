import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import { LEGAL } from "../legal-config";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#f5f7fc] text-[#14213b]">
      <SiteHeader />
      <section className="relative overflow-hidden bg-[#101c34] px-5 py-16 text-white sm:py-24">
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl"><span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-blue-200">Assistance ALEK Artisan</span><h1 className="mt-7 text-4xl font-black tracking-tight sm:text-6xl">Comment pouvons-nous vous aider ?</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Une question sur votre compte, vos documents, votre abonnement ou la confidentialité de vos données ? Notre contact est à votre disposition.</p></div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-12 md:grid-cols-[1.25fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><span className="grid size-14 place-items-center rounded-2xl bg-blue-50 text-2xl text-blue-700">✉</span><h2 className="mt-6 text-2xl font-black">Contacter le support</h2><p className="mt-3 leading-7 text-slate-600">Écrivez-nous depuis votre messagerie en précisant le sujet de votre demande et, si nécessaire, l’adresse e-mail de votre compte.</p><a href={`mailto:${LEGAL.supportEmail}?subject=Assistance%20ALEK%20Artisan`} className="mt-7 inline-flex max-w-full break-all rounded-xl bg-blue-600 px-6 py-4 font-bold text-white hover:bg-blue-700">{LEGAL.supportEmail}</a><p className="mt-5 text-sm leading-6 text-slate-500">Pour une question de paiement, vous pouvez indiquer votre référence de transaction. Ne transmettez jamais le numéro complet de votre carte bancaire ou votre mot de passe.</p></div>
        <aside className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><h2 className="text-2xl font-black">Liens utiles</h2><p className="mt-3 text-sm leading-6 text-slate-600">Retrouvez rapidement les informations importantes.</p><div className="mt-7 grid gap-3">{[{href:"/login",label:"Accéder à mon espace",description:"Vos devis, factures et informations"},{href:"/pricing",label:"Consulter les tarifs",description:"Comparer les offres ALEK"},{href:"/privacy",label:"Confidentialité",description:"Utilisation et protection des données"},{href:"/terms",label:"Conditions d’utilisation",description:"Règles d’utilisation du service"}].map(item=><Link key={item.href} href={item.href} className="group rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50"><strong className="flex justify-between text-sm text-[#14213b]">{item.label}<span className="text-blue-600">↗</span></strong><span className="mt-1 block text-xs text-slate-500">{item.description}</span></Link>)}</div></aside>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-5 py-8 text-sm text-slate-500"><span>© 2026 ALEK Artisan</span><div className="flex gap-5"><Link href="/mentions-legales" className="hover:text-blue-700">Mentions légales</Link><Link href="/refund" className="hover:text-blue-700">Remboursements</Link></div></footer>
    </main>
  );
}
