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

const {hasBlockingStripeSubscription, remainingPlan}=await import("../app/lib/payment-policy.ts");

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
      if(name==="../_shared")return {admin:()=>db,userFrom:async()=>({id:"user"}),paypalBase:()=>"https://mock.invalid",paypalToken:async()=>"mock"};
      throw Error("Unexpected import "+name);
    },
    fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>plan};},
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
