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


export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-stone-900">
      <article className="mx-auto max-w-3xl rounded-3xl border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
        <a href="/pricing" className="text-sm font-semibold text-amber-700">← Retour à ALEK</a>
        <h1 className="mt-5 text-3xl font-black">Conditions d’utilisation</h1>
        <p className="mt-2 text-sm text-stone-500">Dernière mise à jour : {LEGAL.updatedAt}</p>

        <div className="mt-8 space-y-7 leading-7 text-stone-700">
          <section><h2 className="text-xl font-bold text-stone-900">1. Éditeur et service</h2>
            <p className="mt-2">ALEK est un service logiciel en ligne exploité sous la marque {LEGAL.brand}. Éditeur : {LEGAL.legalName}. Adresse : {LEGAL.postalAddress}. Contact : {LEGAL.supportEmail}.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">2. Objet</h2>
            <p className="mt-2">ALEK aide les professionnels à préparer en français des descriptions de prestations, devis, factures et documents associés. Le service peut utiliser une intelligence artificielle pour proposer du texte et structurer des lignes de prestations.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">3. Vérification par l’utilisateur</h2>
            <p className="mt-2">Les contenus générés par l’IA sont des propositions. L’utilisateur reste responsable de la vérification des montants, taux de TVA, mentions obligatoires, coordonnées, dates et de la conformité comptable, fiscale ou juridique de ses documents avant leur utilisation.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">4. Compte</h2>
            <p className="mt-2">L’utilisateur doit fournir des informations exactes, protéger ses identifiants et ne pas permettre un accès non autorisé à son compte. Toute utilisation illicite, frauduleuse ou portant atteinte à des tiers est interdite.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">5. Abonnements</h2>
            <p className="mt-2">ALEK propose une offre gratuite et des offres payantes mensuelles. Les limites de générations IA et les fonctionnalités incluses sont affichées sur la page Tarifs. Les devis et factures sont illimités sur les offres annoncées comme telles.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">6. Paiements et renouvellement</h2>
            <p className="mt-2">Pour les achats traités par Paddle, Paddle agit comme Merchant of Record et est le vendeur de la transaction. Les abonnements payants se renouvellent automatiquement jusqu’à leur résiliation. Les modalités de paiement affichées au checkout prévalent pour la transaction concernée.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">7. Résiliation</h2>
            <p className="mt-2">Un abonnement peut être résilié conformément aux options fournies dans le portail client Paddle ou via les liens contenus dans les e-mails de transaction. Sauf disposition impérative contraire, l’accès payant reste disponible jusqu’à la fin de la période déjà réglée lorsque la résiliation prend effet à l’échéance.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">8. Propriété intellectuelle</h2>
            <p className="mt-2">ALEK, son interface, son logo, ses composants logiciels et ses contenus propres sont protégés. L’utilisateur conserve ses droits sur les informations qu’il saisit et reste responsable de disposer des droits nécessaires sur ces données.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">9. Disponibilité</h2>
            <p className="mt-2">Le service peut être modifié, suspendu temporairement ou faire l’objet de maintenance. Nous cherchons à assurer une disponibilité élevée sans garantir une disponibilité ininterrompue.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">10. Responsabilité</h2>
            <p className="mt-2">Dans les limites autorisées par la loi, ALEK ne saurait être responsable d’une décision prise uniquement sur la base d’un contenu généré automatiquement. Aucune clause des présentes ne limite les droits ou responsabilités qui ne peuvent légalement être exclus.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">11. Données personnelles</h2>
            <p className="mt-2">Le traitement des données personnelles est décrit dans la Politique de confidentialité.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">12. Droit applicable</h2>
            <p className="mt-2">Les présentes sont interprétées conformément au droit applicable à l’éditeur, sous réserve des règles impératives de protection des consommateurs qui pourraient s’appliquer à l’utilisateur.</p>
          </section>
        </div>
        <Footer />
      </article>
    </main>
  );
}
