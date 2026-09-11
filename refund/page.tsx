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


export default function RefundPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-stone-900">
      <article className="mx-auto max-w-3xl rounded-3xl border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
        <a href="/pricing" className="text-sm font-semibold text-amber-700">← Retour à ALEK</a>
        <h1 className="mt-5 text-3xl font-black">Politique d’annulation et de remboursement</h1>
        <p className="mt-2 text-sm text-stone-500">Dernière mise à jour : {LEGAL.updatedAt}</p>
        <div className="mt-8 space-y-7 leading-7 text-stone-700">
          <section><h2 className="text-xl font-bold text-stone-900">1. Abonnements</h2>
            <p className="mt-2">Les offres Pro et Business sont prévues comme des abonnements mensuels renouvelés automatiquement jusqu’à résiliation.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">2. Annulation</h2>
            <p className="mt-2">Lorsque votre abonnement est traité par Paddle, vous pouvez gérer ou annuler l’abonnement depuis le portail client Paddle ou le lien « Gérer l’abonnement » contenu dans votre e-mail de confirmation. Une annulation programmée prend généralement effet à la fin de la période de facturation en cours.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">3. Remboursements et droit de rétractation</h2>
            <p className="mt-2">Les achats traités par Paddle sont soumis à la politique de remboursement de Paddle et aux droits impératifs applicables dans votre pays. Pour les consommateurs de l’Union européenne/EEE, les droits légaux de rétractation applicables restent pleinement réservés.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">4. Demander un remboursement</h2>
            <p className="mt-2">Pour une transaction Paddle, utilisez le lien de gestion présent dans votre reçu ou rendez-vous sur <a className="font-semibold text-amber-700 underline" href="https://paddle.net/" target="_blank" rel="noreferrer">paddle.net</a>. Vous pouvez aussi nous contacter à {LEGAL.supportEmail} afin que nous vous aidions à identifier la transaction.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">5. Effet d’un remboursement</h2>
            <p className="mt-2">Lorsqu’un remboursement est accordé, l’accès aux fonctionnalités payantes associées peut être retiré ou revenir à l’offre gratuite, conformément à l’état de l’abonnement.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">6. Droits obligatoires</h2>
            <p className="mt-2">La présente politique ne réduit aucun droit légal auquel vous ne pouvez pas renoncer. En cas de différence entre cette page et les conditions impératives applicables à une transaction Paddle, les droits obligatoires et les conditions Paddle applicables prévalent.</p>
          </section>
        </div>
        <Footer />
      </article>
    </main>
  );
}
