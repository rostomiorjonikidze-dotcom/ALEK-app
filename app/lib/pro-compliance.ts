export type ClientKind = "professionnel" | "particulier";
export type DocumentKind = "facture" | "devis";
export type ComplianceInput = {
  kind: DocumentKind;
  clientKind: ClientKind;
  documentNumber?: string;
  issueDate?: string;
  deliveryDate?: string;
  clientName?: string;
  clientAddress?: string;
  clientSiren?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerSiret?: string;
  sellerVat?: string;
  vatExempt?: boolean;
  vatRate?: number;
  lines?: { description?: string; quantity?: number; price?: number }[];
  amountHT?: number;
  amountTTC?: number;
  dueDate?: string;
  paymentTerms?: string;
  latePaymentTerms?: string;
  deliveryAddressDifferent?: boolean;
  deliveryAddress?: string;
  contractOutsidePremises?: boolean;
  sector?: string;
};
export type Finding = { level: "important" | "attention"; message: string; reference: string };
export const SOURCES = {
  invoice: "https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir",
  devis: "https://entreprendre.service-public.gouv.fr/vosdroits/F31144",
  reform: "https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique",
  payments: "https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/conditions-generales-de-vente-quelles-mentions-sont-obligatoires",
};
export function paymentClauses(clientKind: ClientKind, days = 30, vatExempt = false): string[] {
  const clauses = [
    "Conditions de paiement : règlement à " + days + " jours à compter de la date de facture, sous réserve des délais légaux et des conditions convenues.",
    "Escompte pour paiement anticipé : néant.",
  ];
  if (clientKind === "professionnel") clauses.push(
    "En cas de retard de paiement : pénalités exigibles de plein droit, sans rappel, au taux de trois fois le taux de l'intérêt légal en vigueur (minimum légal, sous réserve de dispositions applicables).",
    "Indemnité forfaitaire pour frais de recouvrement due par le client professionnel en retard : 40 € (article D. 441-5 du Code de commerce)."
  );
  if (vatExempt) clauses.push("TVA non applicable, article 293 B du CGI (uniquement si le prestataire bénéficie effectivement de la franchise en base).");
  return clauses;
}
export function checkCompliance(v: ComplianceInput): Finding[] {
  const findings: Finding[] = [];
  const add = (level: Finding["level"], message: string, reference = SOURCES.invoice) => findings.push({ level, message, reference });
  if (!v.sellerName?.trim()) add("important", "Identité de l'émetteur manquante.");
  if (!v.sellerAddress?.trim()) add("important", "Adresse de l'émetteur manquante.");
  if (!/^\d{9}(\d{5})?$/.test((v.sellerSiret || "").replace(/\s/g, ""))) add("important", "SIREN (9 chiffres) ou SIRET (14 chiffres) de l'émetteur à vérifier.");
  if (!v.clientName?.trim()) add("important", "Nom ou raison sociale du client manquant.");
  if (!v.clientAddress?.trim()) add("important", "Adresse de facturation du client à renseigner, sauf cas particulier légal.");
  if (!v.issueDate) add("important", "Date du document manquante.");
  if (!v.lines?.length || v.lines.some(line => !line.description?.trim() || !Number.isFinite(line.price))) add("important", "Désignation précise, quantité et prix des lignes à vérifier.");
  if (v.kind === "facture") {
    if (!v.documentNumber?.trim()) add("important", "Numéro unique de facture manquant (séquence chronologique continue).");
    if (!v.deliveryDate) add("attention", "Date de livraison ou d'exécution de la prestation à préciser.");
    if (!v.dueDate && !v.paymentTerms) add("important", "Date d'échéance ou délai de paiement manquant.");
    if (v.clientKind === "professionnel") {
      if (!v.clientSiren || !/^\d{9}$/.test(v.clientSiren.replace(/\D/g, "").slice(0, 9))) add("attention", "SIREN du client professionnel à vérifier selon le calendrier de la réforme.");
      if (!v.latePaymentTerms?.trim()) add("important", "Pénalités de retard et indemnité de recouvrement de 40 € à faire figurer sur les factures B2B.", SOURCES.payments);
    }
    if (!Number.isFinite(v.amountHT) || !Number.isFinite(v.amountTTC)) add("important", "Montants HT et TTC à contrôler.");
    if (v.deliveryAddressDifferent && !v.deliveryAddress?.trim()) add("attention", "Adresse de livraison différente : à indiquer.");
    add("attention", "La génération d'un simple PDF n'est pas une facture électronique réglementaire. Vérifiez vos obligations via une plateforme agréée.", SOURCES.reform);
  } else {
    if (!v.documentNumber?.trim()) add("attention", "Référence du devis à renseigner pour le suivi.");
    if (v.contractOutsidePremises) add("attention", "Vente à distance ou hors établissement : vérifier le droit de rétractation et les informations précontractuelles propres au cas.", SOURCES.devis);
    if (v.sector === "batiment") add("attention", "Bâtiment : vérifier assurance décennale, descriptif, délais, éventuel devis préalable et mentions spécifiques.", SOURCES.devis);
  }
  if (v.vatExempt) add("attention", "Franchise de TVA : confirmer votre éligibilité avant la mention « TVA non applicable, art. 293 B du CGI ».");
  else if (!Number.isFinite(v.vatRate)) add("attention", "Taux et régime de TVA à vérifier.");
  return findings;
}
export type TemplateKind = "contrat" | "offre" | "acceptation" | "cgv";
export function buildTemplate(kind: TemplateKind, data: { provider: string; providerAddress: string; providerSiret: string; client: string; clientAddress: string; description: string; amount: string; deadline: string; clientKind: ClientKind }): string {
  const provider = data.provider || "[Prestataire]";
  const client = data.client || "[Client]";
  const head = "Émetteur : " + provider + "\nAdresse : " + (data.providerAddress || "[Adresse]") + "\nSIREN/SIRET : " + (data.providerSiret || "[Identifiant]") + "\nDestinataire : " + client + "\nAdresse : " + (data.clientAddress || "[Adresse du client]") + "\n";
  const clauses = paymentClauses(data.clientKind).join("\n");
  if (kind === "offre") return "PROPOSITION COMMERCIALE — DOCUMENT À PERSONNALISER\n\n" + head + "\nObjet : " + (data.description || "[Description détaillée des prestations]") + "\nPrix indicatif : " + (data.amount || "[Montant HT/TTC et TVA]") + "\nDélai : " + (data.deadline || "[Délai]") + "\n\n" + clauses + "\n\nValidité de l'offre : [date]. Acceptation : date, nom, signature / accord explicite.\n";
  if (kind === "acceptation") return "BON POUR ACCORD — ACCEPTATION DE DEVIS\n\n" + head + "\nRéférence du devis : [Référence]\nNature : " + (data.description || "[Prestations]") + "\nMontant : " + (data.amount || "[Montant]") + "\n\nJe reconnais avoir pris connaissance du devis et des conditions applicables.\nDate : [JJ/MM/AAAA]\nNom et qualité du signataire : [Nom]\nMention : Bon pour accord\nSignature : [Signature]\n";
  if (kind === "cgv") return "CONDITIONS GÉNÉRALES DE VENTE — TRAME À ADAPTER ET FAIRE VÉRIFIER\n\n" + head + "\n1. Objet et champ d'application : [Préciser].\n2. Prestations, commande et délais : " + (data.description || "[Préciser]") + ".\n3. Prix : " + (data.amount || "[Préciser les tarifs et la TVA]") + ".\n4. Paiement :\n" + clauses + "\n5. Réclamations, responsabilités et garanties : [Adapter au secteur].\n6. Résiliation et litiges : [Adapter B2B/B2C, médiation consommation si applicable].\n7. Vente à distance / hors établissement : [Informations de rétractation si applicables].\n";
  return "CONTRAT DE PRESTATION DE SERVICES — MODÈLE À ADAPTER\n\nEntre :\n" + head + "\nARTICLE 1 — OBJET\n" + (data.description || "[Décrire précisément les prestations et livrables]") + "\n\nARTICLE 2 — DURÉE ET EXÉCUTION\n" + (data.deadline || "[Dates, jalons, lieu d'exécution]") + "\n\nARTICLE 3 — PRIX ET PAIEMENT\n" + (data.amount || "[Prix HT/TTC, TVA, acompte éventuel]") + "\n" + clauses + "\n\nARTICLE 4 — OBLIGATIONS DES PARTIES\n[Définir collaboration, moyens, obligations et responsabilités].\n\nARTICLE 5 — ANNULATION, GARANTIES ET LITIGES\n[Personnaliser selon la prestation, le client et le mode de conclusion].\n\nFait à [Lieu], le [Date].\nPour le prestataire : [Nom et signature]\nPour le client : [Nom et signature]\n";
}
export function reminder(kind: "devis" | "avant" | "retard", p: { client: string; reference: string; amount: string; deadline: string; company: string }) {
  const salut = "Bonjour " + (p.client || "Madame, Monsieur") + ",\n\n";
  const ref = p.reference || "[référence]";
  const amount = p.amount || "[montant]";
  const deadline = p.deadline || "[date]";
  if (kind === "devis") return { subject: "Votre devis " + ref, body: salut + "Veuillez trouver notre proposition commerciale référencée " + ref + ". Nous restons à votre disposition pour toute question ou pour confirmer votre accord.\n\nBien cordialement,\n" + p.company };
  if (kind === "avant") return { subject: "Rappel courtois — facture " + ref, body: salut + "Sauf erreur de notre part, votre facture " + ref + " d'un montant de " + amount + " arrive à échéance le " + deadline + ". Nous vous remercions par avance de votre règlement.\n\nSi le paiement a déjà été effectué, merci de ne pas tenir compte de ce message.\n\nCordialement,\n" + p.company };
  return { subject: "Relance de règlement — facture " + ref, body: salut + "Sauf erreur de notre part, la facture " + ref + " d'un montant de " + amount + ", échue le " + deadline + ", demeure impayée. Nous vous remercions de procéder au règlement ou de nous communiquer sa date prévue.\n\nSi le paiement a déjà été effectué, merci de nous transmettre une confirmation.\n\nCordialement,\n" + p.company };
}
