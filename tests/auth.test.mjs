import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authErrorMessage, passwordIsStrong, initializeAuthSession, signupConfirmationMessage } from "../app/lib/auth.ts";

test("registration and reset share the password policy", () => {
  assert.equal(passwordIsStrong("Valide1234!"), true);
  for (const value of ["Aa1!", "minuscule123!", "MAJUSCULE123!", "SansChiffre!", "SansSymbole123"]) {
    assert.equal(passwordIsStrong(value), false, value);
  }
});

test("provider errors are French and never disclose raw backend details", () => {
  assert.match(authErrorMessage({ message: "Invalid login credentials" }), /incorrect/);
  assert.match(authErrorMessage({ message: "captcha verification failed" }), /CAPTCHA/);
  assert.match(authErrorMessage({ message: "New password should be different from the old password" }), /différent/);
  assert.match(authErrorMessage({ message: "Email rate limit exceeded" }), /Trop de tentatives/);
  assert.match(authErrorMessage({ message: "code verifier missing" }), /navigateur/);
  assert.equal(authErrorMessage({ message: "User already registered" }), signupConfirmationMessage);
  assert.doesNotMatch(authErrorMessage({ message: "User already registered" }), /adresse e-mail.*utilisée/i);
  assert.equal(authErrorMessage(new Error("private backend diagnostic")), "Opération impossible. Vérifiez vos informations et réessayez.");
  assert.equal(authErrorMessage(null), authErrorMessage({}));
});

test("French Supabase email templates use the supported confirmation link placeholder", () => {
  for (const name of ["confirmation.html", "recovery.html"]) {
    const html = readFileSync(new URL(`../supabase/templates/${name}`, import.meta.url), "utf8");
    assert.match(html, /lang="fr"/);
    assert.match(html, /href="{{ \.ConfirmationURL }}"/);
    assert.doesNotMatch(html.replaceAll("{{ .ConfirmationURL }}", ""), /\{\{/g, "only documented .ConfirmationURL placeholder is expected");
    assert.doesNotMatch(html, /https?:\/\/(?!app\.alek\.best)/i, "template must not load remote assets or link to third parties");
  }
});

test("wait for automatic PKCE exchange before reading the recovery session", async () => {
  const calls = [];
  const session = { user: { id: "fixture" } };
  const result = await initializeAuthSession({
    async initialize() { calls.push("initialize"); return { error: null }; },
    async getSession() { calls.push("session"); return { data: { session }, error: null }; },
  });
  assert.equal(result, session);
  assert.deepEqual(calls, ["initialize", "session"]);
});

test("a failed recovery exchange cannot use an unrelated existing session", async () => {
  const error = new Error("expired token");
  await assert.rejects(initializeAuthSession({
    async initialize() { return { error }; },
    async getSession() { assert.fail("must not read stale session"); },
  }), error);
});

test("missing sessions and session errors are handled", async () => {
  assert.equal(await initializeAuthSession({
    async initialize() { return { error: null }; },
    async getSession() { return { data: { session: null }, error: null }; },
  }), null);
  await assert.rejects(initializeAuthSession({
    async initialize() { return { error: null }; },
    async getSession() { return { data: { session: null }, error: new Error("session unavailable") }; },
  }), /session unavailable/);
});
