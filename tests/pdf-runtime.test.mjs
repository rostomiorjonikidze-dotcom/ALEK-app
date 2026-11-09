import test from "node:test";
import assert from "node:assert/strict";
import { createDocumentPdf, savedInvoicePdfData, savedInvoicePdfWarnings } from "../app/lib/document-pdf.ts";
import { loadPdfRuntime } from "../app/lib/pdf-runtime.ts";

const invoiceFixture = {
  document_type: "facture",
  document_number: "FAC-2026-0042",
  document_date: "2026-11-09",
  due_date: "2026-12-09",
  devis_reference: "DEV-2026-0038",
  business_name: "Atelier Démo",
  business_address: "10 rue des Écoles, Paris",
  business_phone: "0102030405",
  business_email: "atelier@example.test",
  business_siret: "12345678901234",
  client_name: "Société Éprouvette",
  client_address: "2 avenue des Tests, Lyon",
  client_phone: "0607080910",
  client_email: "client@example.test",
  description: "Réparation et rénovation réalisées avec soin.",
  services: [{ description: "Rénovation intérieure", quantity: 1, price: 124.99, type: "labor", priceType: "total", hours: 1 }],
  total_ht: "124.99",
  total_vat: "25.00",
  total_ttc: "149.99",
  vat_rate: "20",
  vat_exempt: false,
  client_is_professional: true,
  payment_terms: "30 jours",
  payment_method: "Virement bancaire",
  invoice_status: "unpaid",
};

test("saved invoice PDF snapshot uses persisted identity, lines, dates, and totals", () => {
  const snapshot = savedInvoicePdfData(invoiceFixture);
  assert.equal(snapshot.number, invoiceFixture.document_number);
  assert.equal(snapshot.date, invoiceFixture.document_date);
  assert.equal(snapshot.totalHT, 124.99);
  assert.equal(snapshot.totalVAT, 25);
  assert.equal(snapshot.totalTTC, 149.99);
  assert.equal(snapshot.services[0].description, "Rénovation intérieure");
  assert.throws(() => savedInvoicePdfData({ ...invoiceFixture, document_type: "devis" }));
});

test("historical stored totals are preserved and discrepancies are reported", () => {
  const historical = { ...invoiceFixture, total_vat: "24.98", total_ttc: "149.95" };
  const snapshot = savedInvoicePdfData(historical);
  assert.equal(snapshot.totalHT, 124.99);
  assert.equal(snapshot.totalVAT, 24.98);
  assert.equal(snapshot.totalTTC, 149.95);
  const warnings = savedInvoicePdfWarnings(snapshot);
  assert.ok(warnings.some((warning) => warning.includes("TVA persistée")));
  assert.ok(warnings.some((warning) => warning.includes("TTC enregistré")));
  assert.throws(() => savedInvoicePdfData({ ...invoiceFixture, total_ht: null }), /Montant enregistré invalide/);
});

test("production PDF builder emits accented French PDF bytes across multiple pages", async () => {
  const runtime = await loadPdfRuntime();
  const snapshot = savedInvoicePdfData({
    ...invoiceFixture,
    services: Array.from({ length: 90 }, (_, index) => ({
      description: `Prestation française numéro ${index + 1} — réparation, rénovation et contrôle`,
      quantity: 1,
      price: 124.99,
      type: "labor",
      priceType: "total",
      hours: 1,
    })),
  });
  const pdf = createDocumentPdf(snapshot, runtime, ["Conditions de paiement test", "Clause de retard de paiement test"]);
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.ok(bytes.byteLength > 15_000, `Expected substantial PDF bytes, got ${bytes.byteLength}`);
  assert.ok(pdf.getNumberOfPages() > 1, `Expected multiple pages, got ${pdf.getNumberOfPages()}`);
  assert.equal(snapshot.filename, "ALEK-Facture-FAC-2026-0042.pdf");
});
