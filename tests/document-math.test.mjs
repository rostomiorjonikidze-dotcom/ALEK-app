import test from "node:test";
import assert from "node:assert/strict";
import { serviceTotal, inferUnitPrices } from "../app/lib/document-math.ts";

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
