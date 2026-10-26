import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.ALEK_BASE_URL || "https://app.alek.best";
const publicPaths = [
  "/", "/login", "/pricing", "/deshboard", "/a-propos",
  "/contact", "/privacy", "/terms", "/refund", "/mentions-legales",
];

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
