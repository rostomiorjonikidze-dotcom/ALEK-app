import Link from "next/link";

export default function WelcomePage() {
  return (
    <main
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
          padding: "24px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
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
              fontSize: 12,
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
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/login"
            style={{
              textDecoration: "none",
              color: "#1677e8",
              fontWeight: 700,
              padding: "11px 18px",
              border: "1px solid #1677e8",
              borderRadius: 10,
              background: "#fff",
            }}
          >
            Se connecter
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
            Commencer gratuitement
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
            Pensé pour les professionnels en France 🇫🇷
          </div>

          <h1
            style={{
              fontSize: "clamp(42px, 7vw, 72px)",
              lineHeight: 1.02,
              margin: 0,
              letterSpacing: "-2px",
            }}
          >
            Écrivez dans votre langue.
            <br />
            <span style={{ color: "#1677e8" }}>Travaillez en français.</span>
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
            ALEK transforme votre description en texte professionnel français,
            prépare vos devis et factures et vous aide à gagner du temps au
            quotidien.
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
              Commencer gratuitement
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
              Voir les tarifs
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
            EXEMPLE
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
            “Rénovation complète d’une salle de bain, dépose, plomberie,
            carrelage et installation des équipements.”
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
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
              Devis professionnel
            </div>

            <div style={{ color: "#52647a", lineHeight: 1.7 }}>
              Préparation du chantier, dépose des anciens équipements,
              modification des réseaux de plomberie, pose du carrelage et
              installation complète des nouveaux équipements sanitaires.
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
        <div
          style={{
            textAlign: "center",
            marginBottom: 36,
          }}
        >
          <h2
            style={{
              fontSize: 36,
              margin: 0,
            }}
          >
            Tout ce qu’il vous faut pour travailler plus simplement
          </h2>

          <p
            style={{
              color: "#64748b",
              fontSize: 18,
              marginTop: 12,
            }}
          >
            Un seul espace pour préparer, enregistrer et envoyer vos documents.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          {[
            ["✨", "Assistant IA", "Transformez vos idées en français professionnel."],
            ["📄", "Devis", "Créez des devis clairs et professionnels."],
            ["🧾", "Factures", "Transformez rapidement un devis en facture."],
            ["🏢", "SIRET / SIREN", "Retrouvez plus facilement les informations d’entreprise."],
            ["📥", "PDF", "Générez vos documents en PDF."],
            ["🕘", "Historique", "Retrouvez vos anciens devis et factures."],
          ].map(([icon, title, text]) => (
            <div
              key={title}
              style={{
                background: "#fff",
                border: "1px solid #e7edf5",
                borderRadius: 18,
                padding: 24,
                boxShadow: "0 10px 30px rgba(30, 64, 100, 0.06)",
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
          <h2
            style={{
              fontSize: 38,
              margin: 0,
            }}
          >
            Commencez gratuitement
          </h2>

          <p
            style={{
              color: "#d6e3f2",
              fontSize: 18,
              margin: "14px auto 26px",
              maxWidth: 620,
              lineHeight: 1.6,
            }}
          >
            Créez votre compte ALEK et préparez vos premiers documents en
            quelques minutes.
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
            Créer mon compte
          </Link>
        </div>
      </section>

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
            <Link href="/pricing" style={{ color: "inherit" }}>
              Tarifs
            </Link>
            <Link href="/terms" style={{ color: "inherit" }}>
              Conditions
            </Link>
            <Link href="/privacy" style={{ color: "inherit" }}>
              Confidentialité
            </Link>
            <Link href="/refund" style={{ color: "inherit" }}>
              Remboursement
            </Link>
            <Link href="/contact" style={{ color: "inherit" }}>
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
