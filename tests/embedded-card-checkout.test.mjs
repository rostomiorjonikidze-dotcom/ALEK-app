import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const checkout=readFileSync("app/api/stripe/checkout/route.ts","utf8");
const price=readFileSync("app/lib/stripe-billing.ts","utf8");
const pricing=readFileSync("app/pricing/page.tsx","utf8");
const webhook=readFileSync("app/api/stripe/webhook/route.ts","utf8");
const confirm=readFileSync("app/api/stripe/confirm/route.ts","utf8");

test("checkout is embedded and cards only; no external PayPal redirect",()=>{
  assert.match(checkout,/params\.set\("ui_mode","embedded"\)/);
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

const {hasBlockingStripeSubscription, remainingPlan, planAfterPaypalSync}=await import("../app/lib/payment-policy.ts");
const {billingIdempotencyKey}=await import("../app/lib/billing-idempotency.ts");

test("provider idempotency keys are stable, isolated, and fit PayPal's limit",()=>{
  const paypal=billingIdempotencyKey("paypal","checkout","user-123");
  assert.equal(paypal,billingIdempotencyKey("paypal","checkout","user-123"));
  assert.ok(paypal.length<=38);
  assert.notEqual(paypal,billingIdempotencyKey("stripe","checkout","user-123"));
  assert.notEqual(paypal,billingIdempotencyKey("paypal","cancel","user-123"));
  assert.notEqual(paypal,billingIdempotencyKey("paypal","checkout","user-456"));
  assert.throws(()=>billingIdempotencyKey("paypal","checkout",""),/identity/);
});

test("all nonterminal card subscriptions prevent a second subscription",()=>{
  for(const status of ["active","trialing","past_due","unpaid","paused","incomplete"]){
    assert.equal(hasBlockingStripeSubscription("sub_existing",status),true,status);
  }
  for(const status of ["canceled","incomplete_expired",""]){
    assert.equal(hasBlockingStripeSubscription("sub_existing",status),false,status);
  }
  assert.equal(hasBlockingStripeSubscription(null,"active"),false);
});

test("PayPal cancellation preserves only known active card entitlements and owner access",()=>{
  const prices={pro:"price_pro",business:"price_business"};
  assert.equal(remainingPlan({role:"owner"},prices),"business");
  assert.equal(remainingPlan({stripe_subscription_status:"active",stripe_price_id:"price_pro"},prices),"pro");
  assert.equal(remainingPlan({stripe_subscription_status:"active",stripe_price_id:"price_business"},prices),"business");
  assert.equal(remainingPlan({stripe_subscription_status:"canceled",stripe_price_id:"price_business"},prices),"free");
  assert.equal(remainingPlan({stripe_subscription_status:"active",stripe_price_id:"price_unknown"},prices),"free");
  assert.equal(remainingPlan({stripe_subscription_status:"active"},{}),"free");
});

test("PayPal sync never downgrades or replaces an active Stripe entitlement",()=>{
  assert.equal(planAfterPaypalSync("ACTIVE","business","pro"),"pro");
  assert.equal(planAfterPaypalSync("ACTIVE","pro","business"),"business");
  assert.equal(planAfterPaypalSync("CANCELLED","business","pro"),"pro");
  assert.equal(planAfterPaypalSync("ACTIVE",null,"free"),"free");
});

test("Stripe REST calls pin the version compatible with v3 embedded checkout",()=>{
  assert.match(price,/STRIPE_API_VERSION = "2025-02-24.acacia"/);
  assert.equal((price.match(/"Stripe-Version":STRIPE_API_VERSION/g)||[]).length,2);
});

// Execute the route with isolated provider and database substitutes: no network calls.
const ts=(await import("typescript")).default;
const {runInNewContext}=await import("node:vm");
function paypalRoute(profile,plan){
  const source=readFileSync("app/api/paypal/checkout/route.ts","utf8");
  const calls=[];
  const db={from(table){
    const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:table==="profiles"?profile:null,error:null};}};
    return query;
  }};
  const exports={};
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,process:{env:{PAYPAL_PRO_PLAN_ID:"P-CONFIGURED"}},
    require(name){
      if(name==="next/server")return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
      if(name.endsWith("payment-policy"))return {hasBlockingStripeSubscription};
      if(name.endsWith("billing-idempotency"))return {billingIdempotencyKey};
      if(name==="../_shared")return {admin:()=>db,userFrom:async()=>({id:"user"}),paypalBase:()=>"https://mock.invalid",paypalToken:async()=>"mock"};
      throw Error("Unexpected import "+name);
    },
    fetch:async(url,options)=>{
      calls.push({url,options});
      if(url.endsWith("/v1/billing/subscriptions"))return {ok:true,json:async()=>({links:[{rel:"approve",href:"https://www.sandbox.paypal.com/checkoutnow?token=mock"}]})};
      return {ok:true,json:async()=>plan};
    },
  });
  return {post:()=>exports.POST({json:async()=>({plan:"pro"})}),calls};
}

test("PayPal checkout rejects an existing Stripe subscription before any provider call",async()=>{
  const route=paypalRoute({role:"user",stripe_subscription_id:"sub_existing",stripe_subscription_status:"incomplete"},null);
  assert.equal((await route.post()).status,409);
  assert.equal(route.calls.length,0);
});

test("PayPal checkout fails closed on mismatched prices instead of creating billing plans",async()=>{
  const route=paypalRoute({role:"user"},{id:"P-CONFIGURED",status:"ACTIVE",product_id:"PROD-EXISTING",billing_cycles:[{tenure_type:"REGULAR",frequency:{interval_unit:"MONTH",interval_count:1},pricing_scheme:{fixed_price:{currency_code:"EUR",value:"1.00"}}}]});
  assert.equal((await route.post()).status,503);
  assert.equal(route.calls.length,1);
  assert.equal(route.calls[0].options.method,undefined);
  assert.match(route.calls[0].url,/\/v1\/billing\/plans\/P-CONFIGURED$/);
});

test("PayPal checkout uses a stable provider request ID for duplicate retries",async()=>{
  const validPlan={id:"P-CONFIGURED",status:"ACTIVE",billing_cycles:[{tenure_type:"REGULAR",frequency:{interval_unit:"MONTH",interval_count:1},pricing_scheme:{fixed_price:{currency_code:"EUR",value:"19.99"}}}]};
  const first=paypalRoute({role:"user"},validPlan);
  const second=paypalRoute({role:"user"},validPlan);
  assert.equal((await first.post()).status,200);
  assert.equal((await second.post()).status,200);
  const firstRequest=first.calls.find(call=>call.options?.method==="POST");
  const secondRequest=second.calls.find(call=>call.options?.method==="POST");
  assert.equal(firstRequest.options.headers["PayPal-Request-Id"],secondRequest.options.headers["PayPal-Request-Id"]);
  assert.equal(firstRequest.options.headers["PayPal-Request-Id"],billingIdempotencyKey("paypal","checkout","user"));
  assert.ok(firstRequest.options.headers["PayPal-Request-Id"].length<=38);
});

test("Stripe checkout sends a stable idempotency key to its provider client",async()=>{
  const source=readFileSync("app/api/stripe/checkout/route.ts","utf8");
  const exports={};
  let sentOptions;
  const db={from(){const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:{role:"user",plan:"free"},error:null};}};return query;}};
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,process:{env:{}},URLSearchParams,
    require(name){
      if(name==="next/server")return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
      if(name.endsWith("payment-policy"))return {hasBlockingStripeSubscription};
      if(name.endsWith("billing-idempotency"))return {billingIdempotencyKey};
      if(name.endsWith("_shared"))return {admin:()=>db,userFrom:async()=>({id:"user"})};
      if(name.endsWith("stripe-billing"))return {
        stripeConfigured:()=>true,validatedPrice:async()=>"price_pro",PLAN_CENTS:{pro:1999,business:4999},
        stripeRequest:async(_path,options)=>{sentOptions=options;return {id:"cs_test_mock",client_secret:"secret_mock",amount_total:1999,mode:"subscription"};},
      };
      throw Error("Unexpected import "+name);
    },
  });
  const post=()=>exports.POST({json:async()=>({plan:"pro"})});
  const firstResponse=await post();
  assert.equal(firstResponse.status,200,JSON.stringify(firstResponse.body));
  const firstKey=sentOptions.idempotencyKey;
  assert.equal((await post()).status,200);
  assert.equal(sentOptions.idempotencyKey,firstKey);
  assert.equal(firstKey,billingIdempotencyKey("stripe","checkout","user"));
});

const crypto=await import("node:crypto");
test("a correctly signed but null Stripe event returns a French 400, not an exception",async()=>{
  const exports={};
  const secret="whsec_unit_test_only";
  runInNewContext(ts.transpileModule(webhook,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,Buffer,process:{env:{STRIPE_WEBHOOK_SECRET:secret}},
    require(name){
      if(name==="node:crypto")return crypto;
      if(name==="next/server")return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
      if(name.endsWith("stripe-reconcile"))return {reconcileStripeSubscription:()=>assert.fail("Must not reconcile invalid events")};
      throw Error("Unexpected import "+name);
    },
  });
  const payload="null";
  const timestamp=Math.floor(Date.now()/1000);
  const signature=crypto.createHmac("sha256",secret).update(timestamp+"."+payload).digest("hex");
  const result=await exports.POST(new Request("https://mock.invalid/webhook",{method:"POST",headers:{"stripe-signature":`t=${timestamp},v1=${signature}`},body:payload}));
  assert.equal(result.status,400);
  assert.equal(result.body.error,"Événement incomplet.");
});

test("protected payment routes reject absent or malformed bearer auth before configuration lookup",async()=>{
  let externalCalls=0;
  const unexpected=()=>{externalCalls++;throw Error("Unexpected configured service access");};
  const shared={};
  runInNewContext(ts.transpileModule(readFileSync("app/api/paypal/_shared.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports:shared,process:{env:{}},require:()=>({createClient:unexpected}),fetch:unexpected,
  });
  for(const route of ["paypal/checkout","paypal/sync","paypal/subscription/cancel","stripe/checkout","stripe/confirm","stripe/subscription/cancel"]){
    const exports={};
    runInNewContext(ts.transpileModule(readFileSync(`app/api/${route}/route.ts`,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
      exports,process:{env:{}},
      require(name){
        if(name==="next/server")return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
        if(name.endsWith("_shared"))return shared;
        return new Proxy({},{get:()=>unexpected});
      },fetch:unexpected,
    });
    for(const authorization of [null,"","Bearer","Bearer ","Basic invalid","Bearer token extra"]){
      const headers=authorization===null?{}:{authorization};
      const result=await exports.POST(new Request("https://mock.invalid/",{method:"POST",headers}));
      assert.equal(result.status,401,`${route}: ${authorization}`);
      assert.match(result.body.error,/Connexion requise/);
    }
  }
  assert.equal(externalCalls,0);
});
