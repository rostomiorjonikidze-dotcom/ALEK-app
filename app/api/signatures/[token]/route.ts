import { createHash, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../paypal/_shared";

export const runtime = "nodejs";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v as object).sort().map(k => JSON.stringify(k) + ":" + stable((v as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(v) ?? "null";
}
async function findRequest(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await admin().from("artisan_signature_requests")
    .select("id,status,document_snapshot,snapshot_sha256,expires_at,signer_name,signed_at,signature_sha256")
    .eq("token_hash", sha(token)).maybeSingle();
  return data;
}
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findRequest(token);
  if (!row) return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
  if (row.status === "pending" && Date.parse(row.expires_at) < Date.now()) return NextResponse.json({ error: "Ce lien a expiré." }, { status: 410 });
  if (row.snapshot_sha256 !== sha(stable(row.document_snapshot))) return NextResponse.json({ error: "Intégrité du document non vérifiée." }, { status: 409 });
  const d = row.document_snapshot;
  const doc = {
    document_number: d.document_number, document_date: d.document_date, client_name: d.client_name,
    client_address: d.client_address, business_name: d.business_name, business_address: d.business_address,
    business_siret: d.business_siret, description: d.description, services: d.services,
    total_ht: d.total_ht, total_vat: d.total_vat, total_ttc: d.total_ttc, vat_rate: d.vat_rate,
  };
  return NextResponse.json({ status: row.status, doc, snapshotHash: row.snapshot_sha256, signedAt: row.signed_at, signerName: row.signer_name, signatureHash: row.signature_sha256 },
    { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const row = await findRequest(token);
    if (!row) return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
    if (row.status !== "pending") return NextResponse.json({ error: "Cette demande est déjà traitée." }, { status: 409 });
    if (Date.parse(row.expires_at) < Date.now()) return NextResponse.json({ error: "Lien expiré." }, { status: 410 });
    if (row.snapshot_sha256 !== sha(stable(row.document_snapshot))) return NextResponse.json({ error: "Document modifié." }, { status: 409 });
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
    const signature = typeof body?.signature === "string" ? body.signature : "";
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(signature);
    if (!body?.accept || name.length < 3 || !match || signature.length > 170_000 || signature.length < 500) {
      return NextResponse.json({ error: "Nom, consentement et signature manuscrite requis." }, { status: 400 });
    }
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.length > 125_000 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      return NextResponse.json({ error: "Signature PNG invalide." }, { status: 400 });
    }
    const signedAt = new Date().toISOString();
    const proof = sha(row.snapshot_sha256 + "\n" + name + "\n" + signedAt + "\n" + signature);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const ipHash = ip ? createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "unconfigured").update(ip).digest("hex") : null;
    const { data: updated, error } = await admin().from("artisan_signature_requests")
      .update({ status: "signed", signer_name: name, signer_signature_data: signature, signed_at: signedAt, signature_sha256: proof, signer_ip_hash: ipHash, signer_user_agent: (request.headers.get("user-agent") || "").slice(0, 300), consent_version: "simple-signature-v1" })
      .eq("id", row.id).eq("status", "pending").select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 503 });
    if (!updated) return NextResponse.json({ error: "Cette demande a déjà été signée." }, { status: 409 });
    return NextResponse.json({ status: "signed", signedAt, signatureHash: proof, snapshotHash: row.snapshot_sha256 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Signature impossible." }, { status: 500 });
  }
}
