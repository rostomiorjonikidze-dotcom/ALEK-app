import assert from "node:assert/strict";
import test from "node:test";
import { buildTemplate, checkCompliance, paymentClauses, reminder } from "../app/lib/pro-compliance.ts";

test("40 EUR indemnity applies only to professional clients", () => {
  const b2b = paymentClauses("professionnel").join("\n");
  const b2c = paymentClauses("particulier").join("\n");
  assert.match(b2b, /40 €/);
  assert.doesNotMatch(b2c, /40 €/);
  assert.match(b2b, /pénalités/i);
});
test("invoice checker identifies missing mandatory details", () => {
  const warnings = checkCompliance({kind:"facture",clientKind:"professionnel"});
  assert.ok(warnings.some(w => /numéro unique/i.test(w.message)));
  assert.ok(warnings.some(w => /pénalités de retard/i.test(w.message)));
  assert.ok(warnings.some(w => /plateforme agréée/i.test(w.message)));
});
test("contract and reminder templates use given names", () => {
  const text = buildTemplate("contrat",{provider:"Entreprise A",providerAddress:"Rue A",providerSiret:"123456789",client:"Client B",clientAddress:"Rue B",description:"Réfection toiture",amount:"1250 EUR TTC",deadline:"15 jours",clientKind:"particulier"});
  assert.match(text,/Entreprise A/);
  assert.match(text,/Réfection toiture/);
  assert.doesNotMatch(text,/recouvrement.*40 €/);
  const note=reminder("retard",{client:"Client B",reference:"FAC-01",amount:"120 EUR",deadline:"2026-10-01",company:"Entreprise A"});
  assert.match(note.body,/FAC-01/);
  assert.match(note.body,/Client B/);
});

test("checker rejects malformed client SIREN and inconsistent VAT", () => {
  const warnings = checkCompliance({ kind: "facture", clientKind: "professionnel", clientSiren: "123456789extra", vatExempt: true, vatRate: 20 });
  assert.ok(warnings.some(w => /SIREN du client/.test(w.message)));
  assert.ok(warnings.some(w => w.level === "important" && /taux non nul/.test(w.message)));
});
test("checker flags invalid line quantities and negative prices", () => {
  for (const line of [{ description: "Travaux", price: -1, quantity: 1 }, { description: "Travaux", price: 10, quantity: 0 }]) {
    assert.ok(checkCompliance({ kind: "devis", clientKind: "particulier", lines: [line] }).some(w => /quantité et prix/.test(w.message)));
  }
});
