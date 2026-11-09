import test from "node:test";
import assert from "node:assert/strict";
import { serviceTotal, inferUnitPrices, documentTotals, validPriceLine, validDocumentDates } from "../app/lib/document-math.ts";

test("two contracts priced 1000 EUR each result in 2000 EUR HT", () => {
  const lines = inferUnitPrices("2 contrats à 1000 euros", [{
    description: "Contrat", quantity: 2, price: 1000, hours: 1, priceType: "total",
  }]);
  assert.equal(lines[0].priceType, "unit");
  assert.equal(serviceTotal(lines[0]), 2000);
  assert.equal(Math.round(serviceTotal(lines[0]) * 0.1 * 100) / 100, 200);
});

test("two contracts with global price remain 1000 EUR HT", () => {
  const lines = inferUnitPrices("2 contrats pour 1000 euros au total", [{
    quantity: 2, price: 1000, hours: 1, priceType: "total",
  }]);
  assert.equal(lines[0].priceType, "total");
  assert.equal(serviceTotal(lines[0]), 1000);
});
test("hourly service uses hours and line total is rounded", () => {
  assert.equal(serviceTotal({priceType:"hourly",quantity:1,hours:2.5,price:35}),87.5);
  assert.equal(serviceTotal({priceType:"unit",quantity:3, hours:1,price:19.99}),59.97);
});

test("rounds VAT before adding TTC and handles decimal half cents", () => {
  assert.deepEqual(documentTotals([{ priceType: "total", quantity: 1, hours: 1, price: 0.03 }], 20),
    { totalHT: 0.03, totalVAT: 0.01, totalTTC: 0.04 });
  assert.equal(serviceTotal({ priceType: "unit", quantity: 1, hours: 1, price: 10.075 }), 10.08);
  assert.equal(documentTotals(Array(3).fill({ priceType: "total", quantity: 1, hours: 1, price: 0.1 }), 20).totalHT, 0.3);
});
test("rejects invalid prices and multipliers", () => {
  const line = { priceType: "unit", quantity: 1, hours: 1, price: 10 };
  assert.equal(validPriceLine(line), true);
  assert.equal(validPriceLine({ ...line, hours: 0 }), true);
  for (const patch of [{ quantity: 0 }, { priceType: "hourly", hours: -1 }, { price: Infinity }, { price: NaN }, { price: -1 }, { quantity: Infinity }]) {
    assert.equal(validPriceLine({ ...line, ...patch }), false);
  }
});
test("requires real, chronological document dates", () => {
  assert.equal(validDocumentDates("2026-02-28", "2026-03-30"), true);
  assert.equal(validDocumentDates("2026-02-30", "2026-03-30"), false);
  assert.equal(validDocumentDates("", "2026-03-30"), false);
  assert.equal(validDocumentDates("2026-03-30", "2026-03-29"), false);
});
