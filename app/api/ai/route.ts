import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Plan = "free" | "pro" | "business";

type ReservedUsage = {
  allowed: boolean;
  usage_count: number;
  plan: Plan;
  role: string;
  remaining: number | null;
};

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

export async function POST(request: NextRequest) {
  let admin:
    | ReturnType<typeof createClient>
    | null = null;
  let reservedUserId = "";
  let usageWasReserved = false;

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server environment variables");
      return NextResponse.json(
        { error: "Configuration serveur incomplète." },
        { status: 500 },
      );
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 },
      );
    }

    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Session invalide ou expirée." },
        { status: 401 },
      );
    }

    reservedUserId = user.id;

    const body = await request.json();
    const userText = String(body?.text || body?.description || "").trim();
    const language = String(
      body?.inputLanguage || body?.language || "fr",
    ).trim();

    if (!userText) {
      return NextResponse.json(
        { error: "Texte manquant" },
        { status: 400 },
      );
    }

    const { data: reserveData, error: reserveError } = await (admin as any).rpc(
      "reserve_ai_usage",
      { p_user_id: user.id },
    );

    if (reserveError) {
      console.error("AI usage reserve error:", reserveError);
      return NextResponse.json(
        { error: "Impossible de vérifier votre abonnement." },
        { status: 500 },
      );
    }

    const reserved = Array.isArray(reserveData)
      ? (reserveData[0] as ReservedUsage | undefined)
      : (reserveData as ReservedUsage | null);

    if (!reserved) {
      return NextResponse.json(
        { error: "Profil utilisateur introuvable." },
        { status: 500 },
      );
    }

    if (!reserved.allowed) {
      return NextResponse.json(
        {
          error: "Limite IA atteinte.",
          usageCount: Number(reserved.usage_count || 0),
          remaining: Number(reserved.remaining || 0),
          plan: reserved.plan || "free",
          role: reserved.role || "user",
        },
        { status: 429 },
      );
    }

    usageWasReserved =
      reserved.role !== "owner" && reserved.plan !== "business";

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      temperature: 0.2,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Tu es l'assistant professionnel d'ALEK pour la création de devis et factures.

Tu dois fonctionner pour presque tous les secteurs professionnels :
bâtiment, rénovation, plomberie, électricité, nettoyage, informatique,
développement logiciel, marketing, design, conseil, transport, livraison,
mécanique, entretien, jardinage, photographie, événementiel, formation,
services administratifs, commerce, restauration, maintenance, location,
sous-traitance et autres activités professionnelles.

OBJECTIF :
Transformer fidèlement le texte de l'utilisateur en contenu professionnel
en français pour un devis ou une facture.

RÈGLES :
1. N'invente jamais une prestation non mentionnée.
2. N'invente jamais de prix.
3. N'invente jamais de quantité.
4. Conserve fidèlement les informations fournies.
5. Si aucun prix n'est indiqué, utilise 0.
6. Si aucune quantité n'est indiquée, utilise 1.
7. La description doit être professionnelle et claire.
8. Ne suppose pas que l'activité est artisanale.
9. Identifie intelligemment chaque ligne.

TYPE :
- "labor" : prestation, service, conseil, intervention, développement,
  nettoyage, transport, conception, installation, maintenance, formation, etc.
- "material" : produit, fourniture, équipement, matière, pièce, licence, article.

PRICE TYPE :
- "total" : prix total de la ligne.
- "unit" : prix par unité/pièce/kg/tonne/mètre/produit.
- "hourly" : prix par heure.

EXEMPLES :
"Création d'un site internet 1500 euros"
=> price=1500, priceType="total"

"10 ordinateurs à 500 euros l'unité"
=> quantity=10, price=500, priceType="unit"

"Conseil 5 heures à 80 euros par heure"
=> hours=5, price=80, priceType="hourly"

"70 tonnes de ciment 1000 euros"
=> price=1000, priceType="total"

"70 tonnes de ciment à 1000 euros par tonne"
=> quantity=70, price=1000, priceType="unit"

Réponds UNIQUEMENT avec un JSON valide au format :
{
  "professionalText": "texte professionnel en français",
  "services": [
    {
      "description": "description professionnelle",
      "quantity": 1,
      "price": 0,
      "type": "labor",
      "priceType": "total",
      "hours": 0
    }
  ]
}
          `,
        },
        {
          role: "user",
          content: `
Langue saisie par l'utilisateur : ${language}

Texte utilisateur :
${userText}

Transforme ce texte en contenu professionnel pour devis/facture.
          `,
        },
      ],
    });

    const answer = completion.choices[0]?.message?.content || "";
    const cleaned = answer
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    if (!cleaned) {
      throw new Error("Réponse AI vide");
    }

    const result = JSON.parse(cleaned);

    return NextResponse.json({
      frenchText: result.professionalText || "",
      services: Array.isArray(result.services) ? result.services : [],
      usageCount: Number(reserved.usage_count || 0),
      remaining: reserved.remaining,
      plan: reserved.plan || "free",
      role: reserved.role || "user",
    });
  } catch (error) {
    console.error("AI route error:", error);

    if (admin && reservedUserId && usageWasReserved) {
      const { error: refundError } = await (admin as any).rpc("refund_ai_usage", {
        p_user_id: reservedUserId,
      });
      if (refundError) {
        console.error("AI usage refund error:", refundError);
      }
    }

    return NextResponse.json(
      { error: "Erreur lors de la génération AI" },
      { status: 500 },
    );
  }
}
