import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.ALEK_BASE_URL || "http://127.0.0.1:3000";
const publicPaths = [
  "/", "/login", "/pricing", "/dashboard", "/a-propos",
  "/contact", "/privacy", "/terms", "/refund", "/mentions-legales",
];
const skipNavigationPaths = ["/", "/a-propos", "/contact", "/legal", "/outils-pro", "/pricing", "/welcome"];

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(new URL(path, base), {
      redirect: "manual",
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

for (const path of skipNavigationPaths) {
  test(`${path} provides a skip link and a main landmark after the site header`, async () => {
    const response = await request(path);
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    const html = await response.text();
    assert.ok(html.includes('href="#contenu-principal"'), `${path}: lien de saut absent`);
    assert.ok(/<main\b[^>]*id="contenu-principal"[^>]*tabindex="-1"/i.test(html), `${path}: landmark principal absent ou non focalisable`);
    assert.ok(html.indexOf("<header") < html.indexOf('id="contenu-principal"'), `${path}: l’en-tête doit précéder le contenu principal`);
  });
}

for (const path of publicPaths) {
  test(`GET ${path} returns HTML and 200`, async () => {
    const response = await request(path);
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    assert.match(response.headers.get("content-type") || "", /text\/html/i);
    const html = await response.text();
    assert.match(html, /ALEK/i);
    assert.match(html, /<html\b/i);
  });
}

test("unknown path returns 404", async () => {
  const response = await request("/__alek_smoke_unknown_page_2026");
  assert.equal(response.status, 404);
});

test("AI endpoint rejects unauthenticated POST", async () => {
  const response = await request("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Test sans authentification" }),
  });
  assert.equal(response.status, 401);
});

test("AI endpoint rejects GET", async () => {
  const response = await request("/api/ai");
  assert.equal(response.status, 405);
});

for (const path of ["/api/documents/share", "/api/signatures", "/api/legal/generate", "/api/photo-quote/analyze", "/api/receipts/scan", "/api/paypal/checkout", "/api/paypal/sync", "/api/paypal/subscription/cancel", "/api/stripe/checkout", "/api/stripe/confirm", "/api/stripe/subscription/cancel"]) {
  test(`${path} rejects unauthenticated POST`, async () => {
    const response = await request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, 401);
  });
}

test("signature pages do not leak bearer links via referrers or indexing", async () => {
  const response = await request("/sign/invalid");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
});
