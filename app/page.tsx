"use client";

import Link from "next/link";
import InstallApp from "./components/InstallApp";

const t = {
    connect: "Se connecter",
    start: "Commencer gratuitement",
    badge: "Pour toutes les entreprises en France 🇫🇷",
    hero1: "Créez vos devis.",
    hero2: "Facturez en toute simplicité.",
    intro:
      "ALEK accompagne les indépendants et les entreprises de toutes tailles pour préparer des devis et factures, organiser leurs prestations et retrouver leurs documents.",
    pricing: "Voir les tarifs",
    example: "EXEMPLE",
    exampleInput:
      "Rénovation complète d’une salle de bain, dépose, plomberie, carrelage et installation des équipements.",
    professionalQuote: "Devis professionnel",
    exampleOutput:
      "Préparation du chantier, dépose des anciens équipements, modification des réseaux de plomberie, pose du carrelage et installation complète des nouveaux équipements sanitaires.",
    featuresTitle: "La facturation professionnelle pour toutes les entreprises",
    featuresSub:
      "Indépendants, artisans, commerçants, TPE, PME et grandes entreprises : préparez et retrouvez vos documents au même endroit.",
    ai: "Assistant IA",
    aiText: "Préparez des prestations claires avec l’assistant IA.",
    devis: "Devis",
    devisText: "Créez des devis clairs et professionnels.",
    invoices: "Factures",
    invoicesText: "Convertissez un devis en facture depuis votre espace.",
    siret: "SIRET / SIREN",
    siretText: "Retrouvez plus facilement les informations d’entreprise.",
    pdf: "PDF",
    pdfText: "Générez vos documents en PDF.",
    history: "Historique",
    historyText: "Retrouvez vos anciens devis et factures.",
    ctaTitle: "Commencez gratuitement",
    ctaText:
      "Créez votre compte ALEK et préparez vos premiers documents en quelques minutes.",
    createAccount: "Créer mon compte",
    tariffs: "Tarifs",
    terms: "Conditions",
    privacy: "Confidentialité",
    refund: "Remboursement",
    contact: "Contact",
  };

export default function HomePage() {

  const features = [
    ["✨", t.ai, t.aiText],
    ["📄", t.devis, t.devisText],
    ["🧾", t.invoices, t.invoicesText],
    ["🏢", t.siret, t.siretText],
    ["📥", t.pdf, t.pdfText],
    ["🕘", t.history, t.historyText],
  ];

  return (
    <main
      dir="ltr"
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #f7fbff 0%, #eef6ff 45%, #ffffff 100%)",
        color: "#10233f",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <header
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "22px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 1,
              color: "#1677e8",
            }}
          >
            ALEK
          </div>

          <div
            style={{
              fontSize: 11,
              letterSpacing: 1.3,
              color: "#64748b",
              marginTop: 3,
            }}
          >
            DEVIS • FACTURES • IA
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href="/a-propos" style={{textDecoration:"none",color:"#334155",fontWeight:700,padding:"11px 10px"}}>À propos</Link>
          <InstallApp />

          <Link
            href="/login"
            style={{
              textDecoration: "none",
              color: "#1677e8",
              fontWeight: 700,
              padding: "11px 17px",
              border: "1px solid #1677e8",
              borderRadius: 10,
              background: "#fff",
            }}
          >
            {t.connect}
          </Link>

          <Link
            href="/login"
            style={{
              textDecoration: "none",
              color: "#fff",
              fontWeight: 700,
              padding: "12px 18px",
              borderRadius: 10,
              background: "#1677e8",
              boxShadow: "0 8px 22px rgba(22,119,232,0.22)",
            }}
          >
            {t.start}
          </Link>
        </div>
      </header>

      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "70px 24px 40px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 50,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-block",
              background: "#e8f3ff",
              color: "#1677e8",
              fontWeight: 700,
              fontSize: 14,
              padding: "8px 12px",
              borderRadius: 999,
              marginBottom: 20,
            }}
          >
            {t.badge}
          </div>

          <h1
            style={{
              fontSize: "clamp(42px, 7vw, 72px)",
              lineHeight: 1.04,
              margin: 0,
              letterSpacing: "-2px",
            }}
          >
            {t.hero1}
            <br />
            <span style={{ color: "#1677e8" }}>{t.hero2}</span>
          </h1>

          <p
            style={{
              fontSize: 20,
              lineHeight: 1.6,
              color: "#52647a",
              maxWidth: 680,
              marginTop: 24,
            }}
          >
            {t.intro}
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginTop: 30,
            }}
          >
            <Link
              href="/login"
              style={{
                textDecoration: "none",
                color: "#fff",
                background: "#1677e8",
                padding: "15px 24px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 17,
                boxShadow: "0 10px 28px rgba(22,119,232,0.25)",
              }}
            >
              {t.start}
            </Link>

            <Link
              href="/pricing"
              style={{
                textDecoration: "none",
                color: "#10233f",
                background: "#fff",
                padding: "15px 24px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 17,
                border: "1px solid #dbe7f3",
              }}
            >
              {t.pricing}
            </Link>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5edf6",
            borderRadius: 24,
            padding: 30,
            boxShadow: "0 25px 70px rgba(27, 67, 110, 0.12)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#7b8b9f",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {t.example}
          </div>

          <div
            style={{
              background: "#f6f9fc",
              borderRadius: 14,
              padding: 18,
              color: "#475569",
              lineHeight: 1.6,
              marginBottom: 18,
            }}
          >
            “{t.exampleInput}”
          </div>

          <div
            style={{
              textAlign: "center",
              margin: "12px 0",
              fontSize: 28,
            }}
          >
            ↓
          </div>

          <div
            style={{
              border: "2px solid #d9ebff",
              borderRadius: 14,
              padding: 18,
              background: "#fafdff",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: 18,
                marginBottom: 10,
                color: "#1677e8",
              }}
            >
              {t.professionalQuote}
            </div>

            <div style={{ color: "#52647a", lineHeight: 1.7 }}>
              {t.exampleOutput}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "60px 24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontSize: 36, margin: 0 }}>{t.featuresTitle}</h2>
          <p
            style={{
              color: "#64748b",
              fontSize: 18,
              marginTop: 12,
            }}
          >
            {t.featuresSub}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {features.map(([icon, title, text]) => (
            <div
              key={title}
              style={{
                background: "#fff",
                border: "1px solid #e7edf5",
                borderRadius: 18,
                padding: 24,
                boxShadow: "0 10px 30px rgba(30,64,100,0.06)",
              }}
            >
              <div style={{ fontSize: 30 }}>{icon}</div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  marginTop: 14,
                }}
              >
                {title}
              </div>

              <div
                style={{
                  color: "#64748b",
                  lineHeight: 1.6,
                  marginTop: 8,
                }}
              >
                {text}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "60px 24px",
        }}
      >
        <div
          style={{
            background: "#10233f",
            borderRadius: 26,
            padding: "48px 30px",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <h2 style={{ fontSize: 38, margin: 0 }}>{t.ctaTitle}</h2>

          <p
            style={{
              color: "#d6e3f2",
              fontSize: 18,
              margin: "14px auto 26px",
              maxWidth: 620,
              lineHeight: 1.6,
            }}
          >
            {t.ctaText}
          </p>

          <Link
            href="/login"
            style={{
              display: "inline-block",
              textDecoration: "none",
              color: "#10233f",
              background: "#fff",
              padding: "15px 24px",
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 17,
            }}
          >
            {t.createAccount}
          </Link>
        </div>
      </section>

      <section style={{maxWidth:1180,margin:"0 auto",padding:"20px 24px 65px"}}><div style={{border:"1px solid #dbeafe",borderRadius:26,padding:"clamp(24px,5vw,48px)",background:"linear-gradient(115deg,#eff6ff,#fff)",display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:24,boxShadow:"0 16px 48px rgba(22,119,232,.08)"}}><div style={{maxWidth:650}}><div style={{fontSize:13,fontWeight:800,color:"#1677e8",letterSpacing:2}}>L’UNIVERS ALEK</div><h2 style={{fontSize:"clamp(27px,4vw,38px)",margin:"12px 0",letterSpacing:"-1px"}}>Bien plus que la facturation.</h2><p style={{color:"#52647a",fontSize:17,lineHeight:1.7}}>Découvrez nos autres projets : mise en relation professionnelle, boutique en ligne et outils numériques en développement.</p></div><Link href="/a-propos" style={{textDecoration:"none",background:"#1677e8",color:"#fff",padding:"15px 23px",borderRadius:13,fontWeight:800}}>Découvrir nos projets ↗</Link></div></section>

      <footer
        style={{
          borderTop: "1px solid #e6edf5",
          marginTop: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "28px 24px",
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            color: "#6b7c90",
            fontSize: 14,
          }}
        >
          <div>© 2026 ALEK</div>

          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <Link href="/a-propos" style={{ color: "inherit" }}>À propos</Link>
            <Link href="/pricing" style={{ color: "inherit" }}>
              {t.tariffs}
            </Link>
            <Link href="/terms" style={{ color: "inherit" }}>
              {t.terms}
            </Link>
            <Link href="/privacy" style={{ color: "inherit" }}>
              {t.privacy}
            </Link>
            <Link href="/refund" style={{ color: "inherit" }}>
              {t.refund}
            </Link>
            <Link href="/contact" style={{ color: "inherit" }}>
              {t.contact}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}