import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { admin, userFrom } from "../paypal/_shared";

export const runtime = "nodejs";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v as object).sort().map(k => JSON.stringify(k) + ":" + stable((v as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(v) ?? "null";
}
export async function POST(request: Request) {
  try {
    const user = await userFrom(request);
    if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    const { documentId } = await request.json();
    if (typeof documentId !== "string" || !/^[a-f0-9-]{36}$/i.test(documentId)) return NextResponse.json({ error: "Document invalide." }, { status: 400 });
    const db = admin();
    const { data: doc, error } = await db.from("documents").select("*").eq("id", documentId).eq("user_id", user.id).maybeSingle();
    if (error || !doc || doc.document_type !== "devis") return NextResponse.json({ error: "Devis introuvable." }, { status: 404 });
    if (!doc.client_name || !doc.business_name || !doc.document_number) return NextResponse.json({ error: "Complétez d'abord le devis." }, { status: 422 });
    const rawToken = randomBytes(32).toString("hex");
    const snapshotHash = digest(stable(doc));
    const { error: insertError } = await db.from("artisan_signature_requests").insert({
      user_id: user.id, document_id: doc.id, token_hash: digest(rawToken),
      document_snapshot: doc, snapshot_sha256: snapshotHash, client_email: doc.client_email || null,
      expires_at: new Date(Date.now() + 14 * 86400_000).toISOString(), status: "pending",
    });
    if (insertError) return NextResponse.json({ error: "Impossible de créer la demande de signature." }, { status: 503 });
    return NextResponse.json({ url: "https://app.alek.best/sign/" + rawToken, expiresInDays: 14, note: "Signature électronique simple, sans vérification d'identité forte. Transmettez le lien au destinataire prévu." });
  } catch {
    return NextResponse.json({ error: "Impossible de préparer la signature." }, { status: 500 });
  }
}
