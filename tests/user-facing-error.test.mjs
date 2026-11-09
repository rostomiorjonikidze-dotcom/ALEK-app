import assert from "node:assert/strict";
import test from "node:test";
import { userFacingError } from "../app/lib/user-facing-error.ts";

test("user-facing failures are French operation-specific fallbacks", () => {
  assert.match(userFacingError("load"), /Impossible de charger/);
  assert.match(userFacingError("save"), /L’enregistrement a échoué/);
  assert.match(userFacingError("payment-status"), /statut de paiement/);
  assert.doesNotMatch(Object.values({
    auth: userFacingError("auth"),
    load: userFacingError("load"),
    save: userFacingError("save"),
    delete: userFacingError("delete"),
    scan: userFacingError("scan"),
    share: userFacingError("share"),
    payment: userFacingError("payment-status"),
    signature: userFacingError("signature"),
  }).join(" "), /supabase|postgres|row level|permission denied|stack trace/i);
});
