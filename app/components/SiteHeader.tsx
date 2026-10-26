"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import InstallApp from "./InstallApp";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/a-propos", label: "À propos" },
  { href: "/pricing", label: "Tarifs" },
] as const;

export default function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-950/5 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="ALEK Artisan — accueil">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#101c34] text-xl font-black text-white">A</span>
          <span className="leading-tight"><strong className="block text-xl font-black tracking-tight text-[#14213b]">ALEK <span className="text-blue-600">Artisan</span></strong><span className="block text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Devis · Factures · IA</span></span>
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-2 text-sm font-semibold md:flex">
          {links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} className={`rounded-xl px-4 py-3 transition ${pathname === link.href ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>{link.label}</Link>)}
          <InstallApp />
          <Link href="/login" className="rounded-xl bg-[#152b50] px-5 py-3 font-bold text-white hover:bg-blue-700">Mon espace →</Link>
        </nav>
        <details className="group relative md:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-[#14213b] marker:hidden" aria-label="Ouvrir le menu">☰ Menu</summary>
          <nav aria-label="Navigation mobile" className="absolute right-0 top-full z-50 mt-3 flex min-w-56 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold shadow-xl">
            {links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} className={`rounded-xl px-4 py-3 ${pathname === link.href ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}>{link.label}</Link>)}
            <Link href="/login" className="rounded-xl bg-blue-600 px-4 py-3 text-center font-bold text-white">Mon espace →</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
