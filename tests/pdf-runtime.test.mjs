import test from "node:test";
import assert from "node:assert/strict";
import { loadPdfRuntime } from "../app/lib/pdf-runtime.ts";

test("synthetic French PDF uses embedded fonts and the table plugin", async () => {
  const { jsPDF, autoTable, latinFont, georgianFont } = await loadPdfRuntime();
  const pdf = new jsPDF();
  pdf.addFileToVFS("NotoSans-Regular.ttf", latinFont);
  pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  pdf.addFileToVFS("NotoSansGeorgian-Regular.ttf", georgianFont);
  pdf.addFont("NotoSansGeorgian-Regular.ttf", "NotoGeorgian", "normal");
  pdf.setFont("NotoSans", "normal");
  pdf.text("Épreuve synthétique — facture", 15, 15);
  autoTable(pdf, { head: [["Désignation", "Montant TTC"]], body: [["Prestation à vérifier", "119,99 €"]] });
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  assert.ok(bytes.length > 1000);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
});
