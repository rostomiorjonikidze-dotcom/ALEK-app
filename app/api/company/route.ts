import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const identifier = (request.nextUrl.searchParams.get("identifier") || "").replace(/\D/g, "");

  if (![9, 14].includes(identifier.length)) {
    return NextResponse.json({ error: "SIREN/SIRET invalide" }, { status: 400 });
  }

  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(identifier)}&per_page=10`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Service entreprise indisponible" }, { status: 502 });
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];

    const company =
      results.find((item: any) => {
        if (identifier.length === 9) return String(item?.siren || "") === identifier;
        if (String(item?.siege?.siret || "") === identifier) return true;
        return Array.isArray(item?.matching_etablissements)
          ? item.matching_etablissements.some((e: any) => String(e?.siret || "") === identifier)
          : false;
      }) || results[0];

    if (!company) {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }

    const establishment =
      identifier.length === 14
        ? (Array.isArray(company?.matching_etablissements)
            ? company.matching_etablissements.find((e: any) => String(e?.siret || "") === identifier)
            : null) || (String(company?.siege?.siret || "") === identifier ? company.siege : null)
        : company?.siege;

    const name =
      company?.nom_complet ||
      company?.nom_raison_sociale ||
      company?.nom_raison_sociale_unite_legale ||
      company?.siege?.nom_commercial ||
      "";

    const address =
      establishment?.adresse ||
      company?.siege?.adresse ||
      [
        establishment?.numero_voie || company?.siege?.numero_voie,
        establishment?.type_voie || company?.siege?.type_voie,
        establishment?.libelle_voie || company?.siege?.libelle_voie,
        establishment?.code_postal || company?.siege?.code_postal,
        establishment?.libelle_commune || company?.siege?.libelle_commune,
      ]
        .filter(Boolean)
        .join(" ");

    return NextResponse.json({
      name,
      address,
      siren: company?.siren || identifier.slice(0, 9),
      siret: establishment?.siret || company?.siege?.siret || (identifier.length === 14 ? identifier : ""),
    });
  } catch (error) {
    console.error("Company lookup error", error);
    return NextResponse.json({ error: "Erreur de recherche entreprise" }, { status: 500 });
  }
}
