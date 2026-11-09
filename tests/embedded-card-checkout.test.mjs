import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ts=(await import("typescript")).default;
const {runInNewContext}=await import("node:vm");
const requestBody=await import("../app/lib/request-body.ts");
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
  assert.equal(planAfterPaypalSync("ACTIVE","business","pro"),"business");
  assert.equal(planAfterPaypalSync("ACTIVE","pro","business"),"business");
  assert.equal(planAfterPaypalSync("CANCELLED","business","pro"),"pro");
  assert.equal(planAfterPaypalSync("ACTIVE",null,"free"),"free");
});

test("highest active entitlement is selected in both provider orderings",()=>{
  assert.equal(planAfterPaypalSync("ACTIVE","business","pro"),"business");
  assert.equal(planAfterPaypalSync("ACTIVE","pro","business"),"business");
  assert.equal(planAfterPaypalSync("ACTIVE","pro","free"),"pro");
  assert.equal(planAfterPaypalSync("CANCELLED","business","pro"),"pro");
});

test("Stripe reconciliation resolves active PayPal Business through configured aliases",async()=>{
  const source=readFileSync("app/lib/stripe-reconcile.ts","utf8");
  const exports={};
  let saved;
  const profile={role:"user",plan:"pro",paypal_subscription_id:"I-ALIAS123456789",paypal_subscription_status:"ACTIVE",stripe_subscription_id:null,stripe_subscription_status:null};
  const db={from(table){
    const query={values:null,select(){return query;},eq(){return query;},update(values){query.values=values;return query;},
      async maybeSingle(){return {data:table==="profiles"?profile:null,error:null};},
      then(resolve){if(query.values)saved=query.values;return Promise.resolve({data:[{tier:"business",paypal_plan_id:"P-OVERRIDE-BUSINESS"}],error:null}).then(resolve);}};
    return query;
  }};
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,process:{env:{PAYPAL_ENV:"sandbox"}},Date,
    require(name){
      if(name==="server-only")return {};
      if(name.endsWith("payment-policy"))return {hasBlockingStripeSubscription,planAfterPaypalSync};
      if(name.endsWith("_shared"))return {admin:()=>db,subscription:async()=>({id:profile.paypal_subscription_id,custom_id:"00000000-0000-4000-8000-000000000001",status:"ACTIVE",plan_id:"P-OVERRIDE-BUSINESS"})};
      if(name.endsWith("stripe-billing"))return {
        getSubscription:async()=>({id:"sub_current",status:"active",customer:"cus_mock",metadata:{user_id:"00000000-0000-4000-8000-000000000001"},items:{data:[{price:{id:"price_pro"}}]}}),
        tierFromPrice:id=>id==="price_pro"?"pro":id==="price_business"?"business":null,
        verifiedPaidTier:()=>"pro",
      };
      throw Error("Unexpected import "+name);
    },
  });
  const result=await exports.reconcileStripeSubscription("sub_current");
  assert.equal(result.plan,"business");
  assert.equal(saved.plan,"business");
});

test("Stripe REST calls pin the version compatible with v3 embedded checkout",()=>{
  assert.match(price,/STRIPE_API_VERSION = "2025-02-24.acacia"/);
  assert.equal((price.match(/"Stripe-Version":STRIPE_API_VERSION/g)||[]).length,2);
});

// Execute the route with isolated provider and database substitutes: no network calls.
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

function paypalWebhookRoute({profile,current,verification="SUCCESS",webhookId="WH-TEST"}){
  const source=readFileSync("app/api/paypal/webhook/route.ts","utf8");
  const exports={};
  const calls={verification:[],subscriptions:[],filters:[],updates:[]};
  const db={from(table){
    const query={table,filters:[],values:null,select(){return query;},eq(key,value){query.filters.push([key,value]);return query;},
      update(values){query.values=values;return query;},
      async maybeSingle(){
        calls.filters.push(query.filters);
        return {data:table==="profiles"&&profile&&query.filters.some(([key,value])=>key==="paypal_subscription_id"&&value===profile.paypal_subscription_id)?profile:null,error:null};
      },
      then(resolve){
        calls.filters.push(query.filters);
        if(query.values)calls.updates.push({filters:query.filters,values:query.values});
        return Promise.resolve({data:table==="artisan_paypal_plan_overrides"?[{tier:"pro",paypal_plan_id:"P-PRO"}]:null,error:null}).then(resolve);
      }};
    return query;
  }};
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,process:{env:{PAYPAL_WEBHOOK_ID:webhookId,PAYPAL_PRO_PLAN_ID:"P-PRO",PAYPAL_ENV:"sandbox"}},
    TextEncoder,
    require(name){
      if(name==="next/server")return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
      if(name.endsWith("payment-policy"))return {planAfterPaypalSync,remainingPlan};
      if(name.endsWith("request-body"))return requestBody;
      if(name.endsWith("_shared"))return {
        admin:()=>{calls.admin=(calls.admin||0)+1;return db;},
        paypalBase:()=>"https://mock.invalid",paypalToken:async()=>"mock-token",
        subscription:async(id)=>{calls.subscriptions.push(id);return current;},
      };
      throw Error("Unexpected import "+name);
    },
    fetch:async(url,options)=>{
      calls.verification.push({url,options});
      return {ok:true,json:async()=>({verification_status:verification})};
    },
  });
  return {post:(raw,headers={})=>exports.POST(new Request("https://mock.invalid/webhook",{
    method:"POST",headers:{"content-type":"application/json",...headers},body:raw,
  })),calls};
}

const paypalSignatureHeaders={
  "paypal-auth-algo":"SHA256withRSA","paypal-cert-url":"https://api.paypal.com/cert/test",
  "paypal-transmission-id":"delivery-1","paypal-transmission-sig":"signature",
  "paypal-transmission-time":"2026-11-09T12:00:00Z",
};

test("PayPal webhook verifies raw event with configured ID and reconciles current state only for linked profile",async()=>{
  const subscriptionId="I-ABCDEF123456789";
  const profile={id:"00000000-0000-4000-8000-000000000001",role:"user",paypal_subscription_id:subscriptionId,plan:"free",stripe_subscription_status:null,stripe_price_id:null};
  const route=paypalWebhookRoute({profile,current:{id:subscriptionId,custom_id:profile.id,status:"ACTIVE",plan_id:"P-PRO"}});
  const raw=JSON.stringify({id:"WH-EVENT-1",event_type:"BILLING.SUBSCRIPTION.CANCELLED",resource:{id:subscriptionId,status:"CANCELLED"}});
  const result=await route.post(raw,paypalSignatureHeaders);
  assert.equal(result.status,200);
  assert.equal(route.calls.verification.length,1);
  const verificationBody=JSON.parse(route.calls.verification[0].options.body);
  assert.equal(verificationBody.webhook_id,"WH-TEST");
  assert.deepEqual(verificationBody.webhook_event,JSON.parse(raw));
  assert.deepEqual(route.calls.subscriptions,[subscriptionId]);
  assert.deepEqual(route.calls.updates[0].values.plan,"pro");
  assert.equal(route.calls.updates[0].values.paypal_subscription_status,"ACTIVE");
  assert.ok(route.calls.updates[0].filters.some(([key,value])=>key==="paypal_subscription_id"&&value===subscriptionId));
});

test("PayPal webhook rejects failed provider signature before database or subscription lookup",async()=>{
  const route=paypalWebhookRoute({profile:null,current:null,verification:"FAILURE"});
  const raw=JSON.stringify({id:"WH-EVENT-2",event_type:"BILLING.SUBSCRIPTION.ACTIVATED",resource:{id:"I-ABCDEF123456789"}});
  const result=await route.post(raw,paypalSignatureHeaders);
  assert.equal(result.status,400);
  assert.equal(route.calls.admin,undefined);
  assert.equal(route.calls.subscriptions.length,0);
});

test("PayPal webhook rejects oversized bodies before provider verification",async()=>{
  const route=paypalWebhookRoute({profile:null,current:null});
  const result=await route.post(JSON.stringify({id:"WH-LARGE",event_type:"BILLING.SUBSCRIPTION.UPDATED",resource:{id:"I-ABCDEF123456789",large:"x".repeat(70_000)}}),paypalSignatureHeaders);
  assert.equal(result.status,413);
  assert.equal(route.calls.verification.length,0);
  assert.equal(route.calls.admin,undefined);
});

test("PayPal webhook ignores old subscription IDs and never updates a different profile link",async()=>{
  const profile={id:"00000000-0000-4000-8000-000000000002",role:"user",paypal_subscription_id:"I-OLD12345678901",plan:"free"};
  const route=paypalWebhookRoute({profile,current:{id:"I-NEW12345678901",custom_id:profile.id,status:"ACTIVE",plan_id:"P-PRO"}});
  const raw=JSON.stringify({id:"WH-EVENT-3",event_type:"BILLING.SUBSCRIPTION.ACTIVATED",resource:{id:"I-NEW12345678901"}});
  const result=await route.post(raw,paypalSignatureHeaders);
  assert.equal(result.status,200);
  assert.equal(result.body.ignored,true);
  assert.equal(route.calls.subscriptions.length,0);
  assert.equal(route.calls.updates.length,0);
});

test("PayPal webhook refuses provider subscription owner mismatch without entitlement writes",async()=>{
  const subscriptionId="I-ABCDEF123456789";
  const profile={id:"00000000-0000-4000-8000-000000000004",role:"user",paypal_subscription_id:subscriptionId,plan:"free"};
  const route=paypalWebhookRoute({profile,current:{id:subscriptionId,custom_id:"00000000-0000-4000-8000-000000000005",status:"ACTIVE",plan_id:"P-PRO"}});
  const raw=JSON.stringify({id:"WH-EVENT-4",event_type:"BILLING.SUBSCRIPTION.ACTIVATED",resource:{id:subscriptionId}});
  const result=await route.post(raw,paypalSignatureHeaders);
  assert.equal(result.status,503);
  assert.equal(route.calls.updates.length,0);
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
      if(name.endsWith("request-body"))return requestBody;
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

test("Stripe webhook bounds streamed body bytes and returns the shared reader status",async()=>{
  const exports={};
  const secret="whsec_unit_test_only";
  runInNewContext(ts.transpileModule(webhook,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,Buffer,process:{env:{STRIPE_WEBHOOK_SECRET:secret}},
    require(name){
      if(name==="node:crypto")return crypto;
      if(name==="next/server")return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
      if(name.endsWith("request-body"))return requestBody;
      if(name.endsWith("stripe-reconcile"))return {reconcileStripeSubscription:()=>assert.fail("Must not reconcile an oversized event")};
      throw Error("Unexpected import "+name);
    },
  });
  const result=await exports.POST(new Request("https://mock.invalid/webhook",{method:"POST",body:"x".repeat(1_000_001)}));
  assert.equal(result.status,413);
  assert.equal(result.body.error,"Requête trop volumineuse.");
  const invalidUtf8=await exports.POST(new Request("https://mock.invalid/webhook",{method:"POST",body:new Uint8Array([0xc3,0x28])}));
  assert.equal(invalidUtf8.status,400);
  assert.equal(invalidUtf8.body.error,"Requête JSON invalide.");
});

test("Stripe webhook authenticates exact BOM and whitespace bytes before JSON parsing",async()=>{
  const exports={};
  const secret="whsec_unit_test_only";
  let reconciled=false;
  runInNewContext(ts.transpileModule(webhook,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports,Buffer,process:{env:{STRIPE_WEBHOOK_SECRET:secret}},
    require(name){
      if(name==="node:crypto")return crypto;
      if(name==="next/server")return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
      if(name.endsWith("request-body"))return requestBody;
      if(name.endsWith("stripe-reconcile"))return {reconcileStripeSubscription:async()=>{reconciled=true;}};
      throw Error("Unexpected import "+name);
    },
  });
  const payload="\uFEFF  {\"id\":\"evt_test\",\"type\":\"ignored.event\",\"data\":{\"object\":{}}}  \n";
  const timestamp=Math.floor(Date.now()/1000);
  const signature=crypto.createHmac("sha256",secret).update(timestamp+"."+payload).digest("hex");
  const result=await exports.POST(new Request("https://mock.invalid/webhook",{method:"POST",headers:{"stripe-signature":`t=${timestamp},v1=${signature}`},body:payload}));
  assert.equal(result.status,200);
  assert.equal(result.body.received,true);
  assert.equal(reconciled,false);
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
