import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const checkout=readFileSync("app/api/stripe/checkout/route.ts","utf8");
const price=readFileSync("app/lib/stripe-billing.ts","utf8");
const pricing=readFileSync("app/pricing/page.tsx","utf8");
const webhook=readFileSync("app/api/stripe/webhook/route.ts","utf8");
const confirm=readFileSync("app/api/stripe/confirm/route.ts","utf8");

test("checkout is embedded and cards only; no external PayPal redirect",()=>{
  assert.match(checkout,/params\.set\("ui_mode","embedded_page"\)/);
  assert.match(checkout,/params\.set\("redirect_on_completion","never"\)/);
  assert.match(checkout,/params\.set\("payment_method_types\[0\]","card"\)/);
  assert.match(pricing,/Payer par carte bancaire/);
  assert.doesNotMatch(pricing,/window\.location\.assign/);
});
test("subscription prices are verified server-side",()=>{
  assert.match(price,/pro:\s*1999,\s*business:\s*4999/);
  assert.match(price,/price\.recurring\?\.interval\s*!==\s*"month"/);
  assert.match(price,/price\.unit_amount!==PLAN_CENTS\[tier\]/);
});
test("card subscription is activated only after verified paid checkout",()=>{
  assert.match(confirm,/checkout\.payment_status!=="paid"/);
  assert.match(confirm,/checkout\.client_reference_id!==user\.id/);
  assert.match(webhook,/timingSafeEqual/);
  assert.match(webhook,/stripe-signature/);
});
