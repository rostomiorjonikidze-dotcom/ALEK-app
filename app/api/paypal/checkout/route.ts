import { NextResponse } from "next/server";
import { admin, paypalBase, paypalToken, userFrom } from "../_shared";

export const runtime = "nodejs";
type Tier = "pro" | "business";
type PaypalPlan = {
  id?: string;
  status?: string;
  product_id?: string;
  billing_cycles?: Array<{
    tenure_type?: string;
    frequency?: { interval_unit?: string; interval_count?: number };
    pricing_scheme?: { fixed_price?: { value?: string; currency_code?: string } };
  }>;
};
const prices: Record<Tier, string> = { pro: "19.99", business: "49.99" };

function matchesPrice(plan: PaypalPlan, expected: string): boolean {
  const regular = plan.billing_cycles?.find(cycle => cycle.tenure_type === "REGULAR");
  const fixed = regular?.pricing_scheme?.fixed_price;
  return plan.status === "ACTIVE"
    && regular?.frequency?.interval_unit === "MONTH"
    && Number(regular?.frequency?.interval_count ?? 1) === 1
    && fixed?.currency_code === "EUR"
    && Number.isFinite(Number(fixed?.value))
    && Math.abs(Number(fixed?.value) - Number(expected)) < 0.001;
}
async function getPlan(id: string, token: string): Promise<PaypalPlan | null> {
  if (!/^P-[A-Z0-9]+$/i.test(id)) return null;
  const response = await fetch(paypalBase() + "/v1/billing/plans/" + encodeURIComponent(id), {
    headers: { Authorization: "Bearer " + token }, cache: "no-store",
  });
  return response.ok ? await response.json() as PaypalPlan : null;
}

export async function POST(request: Request) {
  try {
    const user = await userFrom(request);
    if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    const body = await request.json();
    const tier: Tier | null = body?.plan === "pro" ? "pro" : body?.plan === "business" ? "business" : null;
    if (!tier) return NextResponse.json({ error: "Formule sélectionnée invalide." }, { status: 400 });
    const db = admin();
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role,paypal_subscription_id,paypal_subscription_status").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "Profil indisponible." }, { status: 404 });
    if (profile.role === "owner") return NextResponse.json({ error: "Le compte administrateur dispose déjà de toutes les fonctionnalités." }, { status: 409 });
    if (profile.paypal_subscription_id && ["ACTIVE", "APPROVAL_PENDING", "APPROVED", "SUSPENDED"].includes(String(profile.paypal_subscription_status || "").toUpperCase())) {
      return NextResponse.json({ error: "Un abonnement existe déjà ou attend une validation. Vérifiez son statut avant de recommencer afin d’éviter un double abonnement." }, { status: 409 });
    }

    const configuredId = tier === "pro" ? process.env.PAYPAL_PRO_PLAN_ID : process.env.PAYPAL_BUSINESS_PLAN_ID;
    if (!configuredId) return NextResponse.json({ error: "Cette formule n’est pas disponible." }, { status: 503 });
    const env = process.env.PAYPAL_ENV?.toLowerCase() === "live" ? "live" : "sandbox";
    const expected = prices[tier];
    const token = await paypalToken();

    // A newly created plan leaves EXISTING PayPal subscribers on their original plan.
    // Unlike editing the price of an existing plan, this never silently reprices them.
    const { data: override, error: lookupError } = await db.from("artisan_paypal_plan_overrides")
      .select("paypal_plan_id,expected_eur").eq("environment", env).eq("tier", tier).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Impossible de vérifier le plan PayPal." }, { status: 503 });

    let planId: string | null = null;
    if (override?.paypal_plan_id && Number(override.expected_eur) === Number(expected)) {
      const cachedPlan = await getPlan(override.paypal_plan_id, token);
      if (cachedPlan && matchesPrice(cachedPlan, expected)) planId = override.paypal_plan_id;
    }
    if (!planId) {
      const existingPlan = await getPlan(configuredId, token);
      if (!existingPlan) return NextResponse.json({ error: "Impossible de vérifier le tarif PayPal." }, { status: 503 });
      if (matchesPrice(existingPlan, expected)) {
        planId = configuredId;
      } else {
        if (!existingPlan.product_id || !/^PROD-[A-Z0-9]+$/.test(existingPlan.product_id)) {
          return NextResponse.json({ error: "Plan PayPal initial invalide." }, { status: 503 });
        }
        const created = await fetch(paypalBase() + "/v1/billing/plans", {
          method: "POST", cache: "no-store",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            "PayPal-Request-Id": "ALEK-" + env + "-" + tier + "-" + expected.replace(".", "-"),
          },
          body: JSON.stringify({
            product_id: existingPlan.product_id,
            name: "ALEK " + (tier === "pro" ? "Pro" : "Business") + " - " + expected + " EUR / mois",
            description: "Abonnement mensuel ALEK Artisan",
            billing_cycles: [{
              frequency: { interval_unit: "MONTH", interval_count: 1 },
              tenure_type: "REGULAR", sequence: 1, total_cycles: 0,
              pricing_scheme: { fixed_price: { value: expected, currency_code: "EUR" } },
            }],
            payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 1 },
          }),
        });
        if (!created.ok) return NextResponse.json({ error: "Création du nouveau tarif PayPal impossible. Aucun paiement lancé." }, { status: 503 });
        const newPlan = await created.json() as PaypalPlan;
        if (!newPlan.id) return NextResponse.json({ error: "Réponse PayPal invalide" }, { status: 503 });
        if (newPlan.status === "CREATED") {
          const activated = await fetch(paypalBase() + "/v1/billing/plans/" + encodeURIComponent(newPlan.id) + "/activate", {
            method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, cache: "no-store",
          });
          if (!activated.ok) return NextResponse.json({ error: "Activation du tarif PayPal impossible" }, { status: 503 });
        }
        const verified = await getPlan(newPlan.id, token);
        if (!verified || !matchesPrice(verified, expected)) return NextResponse.json({ error: "Nouveau tarif non vérifié. Aucun paiement lancé." }, { status: 503 });
        const { error: storeError } = await db.from("artisan_paypal_plan_overrides")
          .upsert({ environment: env, tier, paypal_plan_id: newPlan.id, expected_eur: Number(expected) }, { onConflict: "environment,tier" });
        if (storeError) return NextResponse.json({ error: "Tarif créé mais non enregistré. Aucun paiement lancé." }, { status: 503 });
        planId = newPlan.id;
      }
    }

    const response = await fetch(paypalBase() + "/v1/billing/subscriptions", {
      method: "POST", cache: "no-store",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "PayPal-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({
        plan_id: planId, custom_id: user.id,
        application_context: {
          brand_name: "ALEK", user_action: "SUBSCRIBE_NOW",
          return_url: "https://app.alek.best/pricing?paypal=success",
          cancel_url: "https://app.alek.best/pricing?paypal=cancel",
        },
      }),
    });
    const result = await response.json();
    const url = result?.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href as string | undefined;
    const valid = url && (url.startsWith("https://www.paypal.com/") || url.startsWith("https://www.sandbox.paypal.com/"));
    if (!response.ok || !valid) return NextResponse.json({ error: "Impossible de lancer l'abonnement PayPal." }, { status: 502 });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Le service de paiement est temporairement indisponible." }, { status: 503 });
  }
}
