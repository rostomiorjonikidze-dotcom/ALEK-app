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


export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fffaf5] px-4 py-10 text-stone-900">
      <article className="mx-auto max-w-3xl rounded-3xl border border-orange-100 bg-white p-7 shadow-sm sm:p-10">
        <a href="/pricing" className="text-sm font-semibold text-amber-700">← Retour à ALEK</a>
        <h1 className="mt-5 text-3xl font-black">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-stone-500">Dernière mise à jour : {LEGAL.updatedAt}</p>
        <div className="mt-8 space-y-7 leading-7 text-stone-700">
          <section><h2 className="text-xl font-bold text-stone-900">1. Responsable du traitement</h2>
            <p className="mt-2">Service : ALEK. Responsable : {LEGAL.legalName}. Adresse : {LEGAL.postalAddress}. Contact confidentialité : {LEGAL.supportEmail}.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">2. Données traitées</h2>
            <p className="mt-2">Selon votre utilisation, ALEK peut traiter les données de compte et d’authentification, coordonnées professionnelles, informations saisies pour créer des devis ou factures, données client que vous choisissez d’enregistrer, historique de documents, données techniques nécessaires au fonctionnement et informations liées à l’abonnement.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">3. Finalités</h2>
            <p className="mt-2">Ces données sont utilisées pour créer et sécuriser votre compte, fournir les fonctions ALEK, générer et enregistrer vos documents, appliquer les limites de votre abonnement, fournir l’assistance, prévenir les abus et respecter nos obligations légales.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">4. Bases juridiques</h2>
            <p className="mt-2">Selon le traitement, les bases peuvent inclure l’exécution du contrat, le respect d’une obligation légale, l’intérêt légitime à sécuriser et améliorer le service, ou votre consentement lorsqu’il est requis.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">5. Prestataires</h2>
            <p className="mt-2">ALEK s’appuie notamment sur des prestataires techniques pour l’hébergement, l’authentification et la base de données, le traitement IA et, lorsque les paiements seront activés, Paddle pour les paiements et abonnements. Certaines données peuvent être transmises à ces prestataires uniquement lorsque cela est nécessaire à la fourniture du service.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">6. Intelligence artificielle</h2>
            <p className="mt-2">Lorsque vous demandez une préparation en français, le contenu nécessaire à cette génération peut être transmis au fournisseur d’IA configuré par ALEK. Évitez d’inclure des données sensibles qui ne sont pas nécessaires au document.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">7. Conservation</h2>
            <p className="mt-2">Les données sont conservées pendant la durée nécessaire à la fourniture du service, au fonctionnement du compte et au respect des obligations légales. Les documents que vous enregistrez peuvent rester associés à votre compte jusqu’à leur suppression ou à la suppression du compte, sous réserve des obligations de conservation applicables.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">8. Stockage local et cookies</h2>
            <p className="mt-2">ALEK peut utiliser le stockage local du navigateur et des technologies strictement nécessaires pour conserver une session, un brouillon ou des préférences. Aucun cookie publicitaire n’est requis pour les fonctions principales décrites ici.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">9. Vos droits</h2>
            <p className="mt-2">Selon la réglementation applicable, notamment le RGPD dans l’EEE, vous pouvez demander l’accès, la rectification, l’effacement, la limitation, l’opposition ou la portabilité de vos données, et retirer votre consentement lorsque le traitement repose sur celui-ci. Contactez {LEGAL.supportEmail}.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">10. Réclamation</h2>
            <p className="mt-2">Si vous résidez dans l’EEE, vous pouvez également saisir l’autorité de protection des données compétente. En France, il s’agit de la CNIL.</p>
          </section>
          <section><h2 className="text-xl font-bold text-stone-900">11. Sécurité</h2>
            <p className="mt-2">Nous mettons en œuvre des mesures raisonnables destinées à protéger les comptes et données. Aucun système informatique ne peut toutefois garantir une sécurité absolue.</p>
          </section>
        </div>
        <Footer />
      </article>
    </main>
  );
}
