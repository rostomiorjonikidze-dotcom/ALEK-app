import test from "node:test";
import assert from "node:assert/strict";
import {
  authErrorMessage,
  initializeRecoverySession,
  registerWithEmailConfirmation,
  requestPasswordRecovery,
  signInWithEmailAndPassword,
  signOutUser,
  updateAccountPassword,
} from "../app/lib/auth.ts";

test("registration sends confirmation redirect, profile metadata and CAPTCHA to Supabase", async () => {
  const session = { user: { id: "user-fixture" } };
  const calls = [];
  const actual = await registerWithEmailConfirmation({
    async signUp(credentials) {
      calls.push(credentials);
      return { data: { session }, error: null };
    },
  }, {
    email: "artisan@example.test",
    password: "SecreT123!",
    options: {
      emailRedirectTo: "https://app.alek.best/login",
      captchaToken: "captcha-fixture",
      data: { first_name: "Ada", last_name: "Martin", company_name: "Atelier", siret: "123456789" },
    },
  });

  assert.equal(actual, session);
  assert.deepEqual(calls[0], {
    email: "artisan@example.test",
    password: "SecreT123!",
    options: {
      emailRedirectTo: "https://app.alek.best/login",
      captchaToken: "captcha-fixture",
      data: { first_name: "Ada", last_name: "Martin", company_name: "Atelier", siret: "123456789" },
    },
  });
});

test("confirmed registration without an immediate session returns null", async () => {
  assert.equal(await registerWithEmailConfirmation({
    async signUp() { return { data: { session: null }, error: null }; },
  }, { email: "artisan@example.test", password: "SecreT123!" }), null);
});

test("login sends supplied credentials and propagates provider errors", async () => {
  const calls = [];
  await signInWithEmailAndPassword({
    async signInWithPassword(credentials) { calls.push(credentials); return { error: null }; },
  }, { email: "artisan@example.test", password: "SecreT123!", options: { captchaToken: "captcha-fixture" } });
  assert.deepEqual(calls[0], {
    email: "artisan@example.test",
    password: "SecreT123!",
    options: { captchaToken: "captcha-fixture" },
  });

  const failure = new Error("Invalid login credentials");
  await assert.rejects(signInWithEmailAndPassword({
    async signInWithPassword() { return { error: failure }; },
  }, { email: "artisan@example.test", password: "wrong" }), failure);
});

test("forgotten-password requests use only the requested redirect and optional CAPTCHA", async () => {
  const calls = [];
  const auth = {
    async resetPasswordForEmail(...args) { calls.push(args); return { error: null }; },
  };
  await requestPasswordRecovery(auth, "artisan@example.test", "https://app.alek.best/reset-password", "captcha-fixture");
  await requestPasswordRecovery(auth, "artisan@example.test", "http://localhost:3000/reset-password");
  assert.deepEqual(calls, [
    ["artisan@example.test", { redirectTo: "https://app.alek.best/reset-password", captchaToken: "captcha-fixture" }],
    ["artisan@example.test", { redirectTo: "http://localhost:3000/reset-password" }],
  ]);

  const failure = new Error("Email rate limit exceeded");
  await assert.rejects(requestPasswordRecovery({
    async resetPasswordForEmail() { return { error: failure }; },
  }, "artisan@example.test", "https://app.alek.best/reset-password"), failure);
});

test("recovery callback awaits PKCE initialization before using the session", async () => {
  const events = [];
  const session = { user: { id: "recovered-fixture" } };
  const actual = await initializeRecoverySession({
    onAuthStateChange(callback) {
      events.push("subscribe");
      this.callback = callback;
      return { data: { subscription: { unsubscribe() { events.push("unsubscribe"); } } } };
    },
    async initialize() {
      events.push("initialize-start");
      await Promise.resolve();
      this.callback("PASSWORD_RECOVERY", session);
      events.push("initialize-finished");
      return { error: null };
    },
    async getSession() { events.push("get-session"); return { data: { session }, error: null }; },
  }, "https://app.alek.best/reset-password?code=pkce-fixture");
  assert.equal(actual, session);
  assert.deepEqual(events, ["subscribe", "initialize-start", "initialize-finished", "get-session", "unsubscribe"]);
});

test("an ordinary existing session is not accepted as a password recovery", async () => {
  const session = { user: { id: "already-signed-in" } };
  let callback;
  let unsubscribed = false;
  await assert.rejects(initializeRecoverySession({
    onAuthStateChange(handler) {
      callback = handler;
      return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
    },
    async initialize() {
      callback("SIGNED_IN", session);
      return { error: null };
    },
    async getSession() { return { data: { session }, error: null }; },
  }, "https://app.alek.best/reset-password"), /recovery flow required/);
  assert.match(authErrorMessage(new Error("recovery flow required")), /lien de récupération/);
  assert.equal(unsubscribed, true);
});

test("recovery requires a matching active session for the PASSWORD_RECOVERY event", async () => {
  const recovered = { user: { id: "recovered-user" } };
  for (const session of [null, { user: { id: "other-user" } }]) {
    let callback;
    await assert.rejects(initializeRecoverySession({
      onAuthStateChange(handler) {
        callback = handler;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async initialize() {
        callback("PASSWORD_RECOVERY", recovered);
        return { error: null };
      },
      async getSession() { return { data: { session }, error: null }; },
    }, "https://app.alek.best/reset-password?code=pkce-fixture"), /recovery flow required/);
  }
});

test("recovery initialization and session errors propagate and unsubscribe", async () => {
  for (const phase of ["initialize", "get-session"]) {
    const failure = new Error(`${phase} unavailable`);
    let callback;
    let unsubscribed = false;
    await assert.rejects(initializeRecoverySession({
      onAuthStateChange(handler) {
        callback = handler;
        return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
      },
      async initialize() {
        if (phase === "initialize") return { error: failure };
        callback("PASSWORD_RECOVERY", { user: { id: "recovered-user" } });
        return { error: null };
      },
      async getSession() { return { data: { session: null }, error: failure }; },
    }, "https://app.alek.best/reset-password?code=pkce-fixture"), failure);
    assert.equal(unsubscribed, true);
  }
});

test("a failed recovery callback cannot fall back to a pre-existing session", async () => {
  for (const href of [
    "https://app.alek.best/reset-password?error=access_denied",
    "https://app.alek.best/reset-password#error=access_denied",
    "https://app.alek.best/reset-password?error_description=expired",
  ]) {
    let initialized = false;
    await assert.rejects(initializeRecoverySession({
      async initialize() { initialized = true; return { error: null }; },
      async getSession() { assert.fail("must not read an unrelated existing session"); },
    }, href), /expired token/);
    assert.equal(initialized, false, href);
  }
});

test("password updates and logout surface provider failures instead of reporting success", async () => {
  const calls = [];
  await updateAccountPassword({
    async updateUser(value) { calls.push(["update", value]); return { error: null }; },
  }, "NewPass123!");
  await signOutUser({
    async signOut() { calls.push(["sign-out"]); return { error: null }; },
  });
  assert.deepEqual(calls, [["update", { password: "NewPass123!" }], ["sign-out"]]);

  const failure = new Error("provider unavailable");
  await assert.rejects(updateAccountPassword({ async updateUser() { return { error: failure }; } }, "NewPass123!"), failure);
  await assert.rejects(signOutUser({ async signOut() { return { error: failure }; } }), failure);
});
