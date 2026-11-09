import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHmac} from "node:crypto";
import {runInNewContext} from "node:vm";
import test from "node:test";
import ts from "typescript";

function loadModule(path, dependencies, env = {}, globals = {}) {
  const exports = {};
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS},
  }).outputText;
  runInNewContext(compiled, {
    exports,
    process: {env},
    Buffer,
    ...globals,
    require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      const match = Object.entries(dependencies).find(([suffix]) => name.endsWith(suffix));
      if (match) return match[1];
      throw Error(`Unexpected import ${name} from ${path}`);
    },
  });
  return exports;
}

function nextResponse() {
  return {json: (body, options) => ({body, status: options?.status || 200})};
}

test("Stripe reconciliation completes the matching Checkout Session after state application", async () => {
  const calls = [];
  const db = {};
  const reconciliation = loadModule("app/lib/stripe-reconcile.ts", {
    "server-only": {},
    "_shared": {admin: () => db},
    "billing-store": {
      applyVerifiedBillingState: async () => ({applied: true, plan: "pro", payment_verified: true}),
      finishProviderCheckout: async (...args) => calls.push(args),
    },
    "stripe-billing": {
      getSubscription: async id => ({
        id, status: "active", customer: "cus_test", metadata: {user_id: "user-1"},
        current_period_end: Math.floor(Date.now() / 1000) + 3600,
        items: {data: [{price: {id: "price_pro"}}]}, latest_invoice: {paid: true},
      }),
      tierFromPrice: id => id === "price_pro" ? "pro" : null,
      verifiedSubscriptionPrice: async () => "price_pro",
      verifiedPaidTier: () => "pro",
    },
  });

  const result = await reconciliation.reconcileStripeSubscription("sub_test", "user-1", {
    checkoutSessionId: "cs_test_session",
  });
  assert.equal(result.active, true);
  assert.deepEqual(calls, [[db, "stripe", "cs_test_session", "complete"]]);
});

test("Stripe reconciliation retries checkout finalization for duplicate or stale state events", async () => {
  for (const reason of ["duplicate", "out_of_order"]) {
    const calls = [];
    const db = {};
    const reconciliation = loadModule("app/lib/stripe-reconcile.ts", {
      "server-only": {},
      "_shared": {admin: () => db},
      "billing-store": {
        applyVerifiedBillingState: async () => ({applied: false, reason, plan: "pro"}),
        finishProviderCheckout: async (...args) => calls.push(args),
      },
      "stripe-billing": {
        getSubscription: async id => ({
          id, status: "active", customer: "cus_test", metadata: {user_id: "user-1"},
          current_period_end: Math.floor(Date.now() / 1000) + 3600,
          items: {data: [{price: {id: "price_pro"}}]}, latest_invoice: {paid: true},
        }),
        tierFromPrice: id => id === "price_pro" ? "pro" : null,
        verifiedSubscriptionPrice: async () => "price_pro",
        verifiedPaidTier: () => "pro",
      },
    });

    const result = await reconciliation.reconcileStripeSubscription("sub_test", "user-1", {
      checkoutSessionId: "cs_test_session",
    });
    assert.equal(result.reason, reason);
    assert.deepEqual(calls, [[db, "stripe", "cs_test_session", "complete"]]);
  }
});

test("Stripe confirmation passes the verified session ID to reconciliation", async () => {
  const calls = [];
  const route = loadModule("app/api/stripe/confirm/route.ts", {
    "next/server": {NextResponse: nextResponse()},
    "_shared": {userFrom: async () => ({id: "user-1"})},
    "stripe-billing": {
      stripeConfigured: () => true,
      stripeRequest: async () => ({
        id: "cs_test_session", status: "complete", payment_status: "paid", mode: "subscription",
        subscription: "sub_test", client_reference_id: "user-1",
      }),
    },
    "stripe-reconcile": {
      reconcileStripeSubscription: async (...args) => {
        calls.push(args);
        return {status: "active", active: true, plan: "pro"};
      },
    },
  });
  const response = await route.POST(new Request("https://app.invalid/confirm", {
    method: "POST", headers: {"content-type": "application/json"},
    body: JSON.stringify({sessionId: "cs_test_session"}),
  }));
  assert.equal(response.status, 200);
  assert.equal(calls[0][2].checkoutSessionId, "cs_test_session");
});

test("Stripe checkout webhook passes its session ID to reconciliation", async () => {
  const secret = "whsec_local_test";
  const calls = [];
  const bodyReader = {
    RequestBodyError: class RequestBodyError extends Error {},
    readTextBody: request => request.text(),
  };
  const route = loadModule("app/api/stripe/webhook/route.ts", {
    "node:crypto": await import("node:crypto"),
    "next/server": {NextResponse: nextResponse()},
    "stripe-reconcile": {reconcileStripeSubscription: async (...args) => calls.push(args)},
    "stripe-billing": {stripeRequest: async () => assert.fail("Unexpected Stripe lookup")},
    "_shared": {admin: () => assert.fail("Unexpected database access")},
    "billing-store": {finishProviderCheckout: async () => assert.fail("Unexpected checkout expiry")},
    "request-body": bodyReader,
  }, {STRIPE_WEBHOOK_SECRET: secret});
  const payload = JSON.stringify({
    id: "evt_checkout", type: "checkout.session.completed", created: Math.floor(Date.now() / 1000),
    data: {object: {
      id: "cs_test_session", mode: "subscription", subscription: "sub_test",
    }},
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const response = await route.POST(new Request("https://app.invalid/webhook", {
    method: "POST", headers: {"stripe-signature": `t=${timestamp},v1=${signature}`}, body: payload,
  }));
  assert.equal(response.status, 200);
  assert.equal(calls[0][2].checkoutSessionId, "cs_test_session");
});

function paypalCancelRoute({initial, reconciledActive = true}) {
  const calls = [];
  let current = {...initial};
  const db = {
    from() {
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() { return {data: {paypal_subscription_id: "I-TEST12345678"}, error: null}; },
      };
      return query;
    },
  };
  const route = loadModule("app/api/paypal/subscription/cancel/route.ts", {
    "billing-idempotency": {billingIdempotencyKey: () => "alek-test-key"},
    "billing-paypal": {
      verifyPaypalSubscription: async () => ({...current}),
      reconcilePaypalSubscription: async (_userId, details) => {
        calls.push(`reconcile:${details.status}`);
        if (details.status === "CANCELLED") return {active: true, plan: "pro"};
        return {active: reconciledActive, plan: reconciledActive ? "pro" : "free"};
      },
    },
    "next/server": {NextResponse: nextResponse()},
    "_shared": {
      admin: () => db,
      paypalBase: () => "https://paypal.invalid",
      paypalToken: async () => "mock-token",
      userFrom: async () => ({id: "user-1"}),
    },
  }, {}, {fetch: (...args) => globalThis.fetch(...args)});
  const fetchCalls = [];
  return {
    calls,
    async post() {
      const response = await route.POST(new Request("https://app.invalid/cancel", {method: "POST"}));
      return response;
    },
    installFetch() {
      globalThis.fetch = async url => {
        fetchCalls.push(String(url));
        current = {...current, status: "CANCELLED"};
        return {ok: true};
      };
      return fetchCalls;
    },
  };
}

test("PayPal cancellation records verified paid-through before sending cancellation", async () => {
  const originalFetch = globalThis.fetch;
  const route = paypalCancelRoute({initial: {
    id: "I-TEST12345678", custom_id: "user-1", status: "ACTIVE",
    billing_info: {next_billing_time: new Date(Date.now() + 86_400_000).toISOString()},
  }});
  try {
    const fetchCalls = route.installFetch();
    const response = await route.post();
    assert.equal(response.status, 200);
    assert.deepEqual(route.calls, ["reconcile:ACTIVE", "reconcile:CANCELLED"]);
    assert.equal(fetchCalls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PayPal cancellation fails closed when paid-through cannot be verified", async () => {
  const originalFetch = globalThis.fetch;
  const route = paypalCancelRoute({initial: {
    id: "I-TEST12345678", custom_id: "user-1", status: "ACTIVE",
    billing_info: {next_billing_time: new Date(Date.now() + 86_400_000).toISOString()},
  }, reconciledActive: false});
  try {
    const fetchCalls = route.installFetch();
    const response = await route.post();
    assert.equal(response.status, 503);
    assert.equal(fetchCalls.length, 0);
    assert.deepEqual(route.calls, ["reconcile:ACTIVE"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PayPal active subscription without a future billing boundary is not cancelled", async () => {
  const originalFetch = globalThis.fetch;
  const route = paypalCancelRoute({initial: {id: "I-TEST12345678", custom_id: "user-1", status: "ACTIVE"}});
  try {
    const fetchCalls = route.installFetch();
    const response = await route.post();
    assert.equal(response.status, 503);
    assert.equal(fetchCalls.length, 0);
    assert.deepEqual(route.calls, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
