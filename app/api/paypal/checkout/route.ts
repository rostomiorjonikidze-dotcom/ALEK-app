import { hasBlockingStripeSubscription } from "../../../lib/payment-policy";
import { claimCheckout, finishCheckout } from "../../../lib/billing-store";
import { NextResponse } from "next/server";
import { admin, paypalBase, paypalToken, subscription, userFrom } from "../_shared";

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
    const body = await request.json().catch(() => ({}));
    const tier: Tier | null = body?.plan === "pro" ? "pro" : body?.plan === "business" ? "business" : null;
    if (!tier) return NextResponse.json({ error: "Formule sélectionnée invalide." }, { status: 400 });
    const db = admin();
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("role,paypal_subscription_id,paypal_subscription_status,stripe_subscription_id,stripe_subscription_status").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "Profil indisponible." }, { status: 404 });
    if (profile.role === "owner") return NextResponse.json({ error: "Le compte administrateur dispose déjà de toutes les fonctionnalités." }, { status: 409 });
    if (profile.paypal_subscription_id && ["ACTIVE", "APPROVAL_PENDING", "APPROVED", "SUSPENDED"].includes(String(profile.paypal_subscription_status || "").toUpperCase())) {
      return NextResponse.json({ error: "Un abonnement existe déjà ou attend une validation. Vérifiez son statut avant de recommencer afin d’éviter un double abonnement." }, { status: 409 });
    }

    if (hasBlockingStripeSubscription(profile.stripe_subscription_id, profile.stripe_subscription_status)) {
      return NextResponse.json({ error: "Un abonnement par carte existe déjà. Vérifiez son statut avant de souscrire avec PayPal afin d’éviter un double prélèvement." }, { status: 409 });
    }

    const configuredId = tier === "pro" ? process.env.PAYPAL_PRO_PLAN_ID : process.env.PAYPAL_BUSINESS_PLAN_ID;
    if (!configuredId) return NextResponse.json({ error: "Cette formule n’est pas disponible." }, { status: 503 });
    const env = process.env.PAYPAL_ENV?.toLowerCase() === "live" ? "live" : "sandbox";
    const expected = prices[tier];
    const token = await paypalToken();

    // Checkout validates existing plans; it must never change the billing catalog.
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
        return NextResponse.json({ error: "Le tarif PayPal configuré ne correspond pas à cette formule. Contactez le support. Aucun paiement n’a été lancé." }, { status: 503 });
      }
    }

    const claim = await claimCheckout(db, user.id, "paypal", tier);
    if (claim.decision === "busy") return NextResponse.json({ error: "Une demande d’abonnement est déjà en cours. Réessayez dans un instant." }, { status: 409 });
    if (claim.decision === "conflict") return NextResponse.json({ error: "Une autre demande d’abonnement est en attente. Terminez-la ou contactez le support avant de réessayer." }, { status: 409 });
    if (claim.decision === "manual_review") return NextResponse.json({ error: "Une demande précédente doit être vérifiée par le support avant toute nouvelle tentative. Aucun autre paiement n’a été lancé." }, { status: 409 });
    if (claim.decision === "reuse") {
      if (!claim.approval_url || !claim.provider_resource_id) return NextResponse.json({ error: "Une demande PayPal existe déjà mais doit être vérifiée par le support." }, { status: 409 });
      const expectedOrigin = env === "live" ? "https://www.paypal.com/" : "https://www.sandbox.paypal.com/";
      if (!claim.approval_url.startsWith(expectedOrigin)) return NextResponse.json({ error: "Lien PayPal existant non vérifiable." }, { status: 503 });
      return NextResponse.json({ url: claim.approval_url }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!claim.attempt_id || typeof claim.fence !== "number" || !claim.idempotency_key)
      throw Error("Invalid checkout claim");

    let response: Response;
    try {
      response = await fetch(paypalBase() + "/v1/billing/subscriptions", {
      method: "POST", cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        "PayPal-Request-Id": claim.idempotency_key,
      },
      body: JSON.stringify({
        plan_id: planId, custom_id: user.id,
        application_context: {
          brand_name: "ALEK", user_action: "SUBSCRIBE_NOW",
          return_url: "https://app.alek.best/pricing?paypal=success",
          cancel_url: "https://app.alek.best/pricing?paypal=cancel",
        },
      }),
      });
    } catch (error) {
      await finishCheckout(db, claim.attempt_id, claim.fence, "unknown");
      throw error;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await finishCheckout(db, claim.attempt_id, claim.fence, response.status < 500 ? "failed" : "unknown");
      return NextResponse.json({ error: "Impossible de lancer l'abonnement PayPal." }, { status: 502 });
    }
    if (typeof result?.id !== "string" || !/^I-[A-Z0-9]{8,30}$/i.test(result.id))
      return NextResponse.json({ error: "Impossible de vérifier la demande PayPal." }, { status: 502 });
    let confirmed = result;
    if (typeof result.plan_id !== "string" || typeof result.custom_id !== "string") {
      confirmed = await subscription(result.id);
    }
    if (confirmed?.id !== result.id || confirmed?.plan_id !== planId || confirmed?.custom_id !== user.id) {
      return NextResponse.json({
        error: "Une demande PayPal antérieure est en attente avec une formule différente ou un autre compte. Ne l’approuvez pas; contactez le support pour l’annuler avant de réessayer.",
      }, { status: 409 });
    }
    const url = result?.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href as string | undefined;
    const valid = url && (url.startsWith("https://www.paypal.com/") || url.startsWith("https://www.sandbox.paypal.com/"));
    if (!valid) {
      await finishCheckout(db, claim.attempt_id, claim.fence, "pending", result.id);
      return NextResponse.json({ error: "La demande PayPal a été créée mais son lien doit être vérifié par le support." }, { status: 502 });
    }
    await finishCheckout(db, claim.attempt_id, claim.fence, "pending", result.id, url);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Le service de paiement est temporairement indisponible." }, { status: 503 });
  }
}
