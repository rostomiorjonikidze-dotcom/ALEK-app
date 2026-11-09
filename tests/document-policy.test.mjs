import test from "node:test";
import assert from "node:assert/strict";
import { canDeleteDocument, canModifyDocument, isIssuedInvoice } from "../app/lib/document-policy.ts";

test("persisted invoices are protected while quotes retain existing editing actions", () => {
  const invoice = { document_type: "facture" };
  const quote = { document_type: "devis" };
  assert.equal(isIssuedInvoice(invoice), true);
  assert.equal(canModifyDocument(invoice), false);
  assert.equal(canDeleteDocument(invoice), false);
  assert.equal(canModifyDocument(quote), true);
  assert.equal(canDeleteDocument(quote), true);
});
