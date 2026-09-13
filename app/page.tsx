"use client";

import Link from "next/link";
import { useState } from "react";

type Lang = "fr" | "ka" | "ru" | "de" | "ar";

const translations = {
  fr: {
    connect: "Se connecter",
    start: "Commencer gratuitement",
    badge: "Pensé pour les professionnels en France 🇫🇷",
    hero1: "Écrivez dans votre langue.",
    hero2: "Travaillez en français.",
    intro:
      "ALEK transforme votre description en texte professionnel français, prépare vos devis et factures et vous aide à gagner du temps au quotidien.",
    pricing: "Voir les tarifs",
    example: "EXEMPLE",
    exampleInput:
      "Rénovation complète d’une salle de bain, dépose, plomberie, carrelage et installation des équipements.",
    professionalQuote: "Devis professionnel",
    exampleOutput:
      "Préparation du chantier, dépose des anciens équipements, modification des réseaux de plomberie, pose du carrelage et installation complète des nouveaux équipements sanitaires.",
    featuresTitle: "Tout ce qu’il vous faut pour travailler plus simplement",
    featuresSub:
      "Un seul espace pour préparer, enregistrer et envoyer vos documents.",
    ai: "Assistant IA",
    aiText: "Transformez vos idées en français professionnel.",
    devis: "Devis",
    devisText: "Créez des devis clairs et professionnels.",
    invoices: "Factures",
    invoicesText: "Transformez rapidement un devis en facture.",
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
  },

  ka: {
    connect: "შესვლა",
    start: "დაიწყე უფასოდ",
    badge: "შექმნილია საფრანგეთში მომუშავე პროფესიონალებისთვის 🇫🇷",
    hero1: "დაწერე შენს ენაზე.",
    hero2: "იმუშავე ფრანგულად.",
    intro:
      "ALEK შენს აღწერას პროფესიონალურ ფრანგულ ტექსტად გარდაქმნის, ამზადებს დევიზებსა და ინვოისებს და ყოველდღიურ სამუშაოში დროს გიზოგავს.",
    pricing: "ფასების ნახვა",
    example: "მაგალითი",
    exampleInput:
      "აბაზანის სრული რემონტი, დემონტაჟი, სანტექნიკა, კაფელი და მოწყობილობების მონტაჟი.",
    professionalQuote: "პროფესიონალური დევიზი",
    exampleOutput:
      "სამუშაო ადგილის მომზადება, ძველი მოწყობილობების დემონტაჟი, სანტექნიკის ქსელის ცვლილება, კაფელის დაგება და ახალი სანიტარული მოწყობილობების სრული მონტაჟი.",
    featuresTitle: "ყველაფერი, რაც სამუშაოს გასამარტივებლად გჭირდება",
    featuresSub:
      "ერთი სივრცე დოკუმენტების მოსამზადებლად, შესანახად და გასაგზავნად.",
    ai: "AI ასისტენტი",
    aiText: "გარდაქმენი შენი აზრი პროფესიონალურ ფრანგულ ტექსტად.",
    devis: "დევიზები",
    devisText: "შექმენი მკაფიო და პროფესიონალური დევიზები.",
    invoices: "ინვოისები",
    invoicesText: "სწრაფად გარდაქმენი დევიზი ინვოისად.",
    siret: "SIRET / SIREN",
    siretText: "უფრო მარტივად იპოვე კომპანიის ინფორმაცია.",
    pdf: "PDF",
    pdfText: "შექმენი შენი დოკუმენტები PDF ფორმატში.",
    history: "ისტორია",
    historyText: "ნახე ძველი დევიზები და ინვოისები.",
    ctaTitle: "დაიწყე უფასოდ",
    ctaText:
      "შექმენი ALEK-ის ანგარიში და მოამზადე პირველი დოკუმენტები რამდენიმე წუთში.",
    createAccount: "ანგარიშის შექმნა",
    tariffs: "ფასები",
    terms: "პირობები",
    privacy: "კონფიდენციალურობა",
    refund: "ანაზღაურება",
    contact: "კონტაქტი",
  },

  ru: {
    connect: "Войти",
    start: "Начать бесплатно",
    badge: "Создано для профессионалов, работающих во Франции 🇫🇷",
    hero1: "Пишите на своём языке.",
    hero2: "Работайте на французском.",
    intro:
      "ALEK превращает ваше описание в профессиональный французский текст, помогает создавать сметы и счета и экономит ваше время.",
    pricing: "Посмотреть тарифы",
    example: "ПРИМЕР",
    exampleInput:
      "Полный ремонт ванной комнаты, демонтаж, сантехника, плитка и установка оборудования.",
    professionalQuote: "Профессиональная смета",
    exampleOutput:
      "Подготовка объекта, демонтаж старого оборудования, изменение сантехнических сетей, укладка плитки и полная установка нового санитарного оборудования.",
    featuresTitle: "Всё необходимое для более простой работы",
    featuresSub:
      "Одно пространство для создания, хранения и отправки документов.",
    ai: "ИИ-помощник",
    aiText: "Превращайте свои идеи в профессиональный французский текст.",
    devis: "Сметы",
    devisText: "Создавайте понятные и профессиональные сметы.",
    invoices: "Счета",
    invoicesText: "Быстро превращайте смету в счёт.",
    siret: "SIRET / SIREN",
    siretText: "Быстро находите информацию о компаниях.",
    pdf: "PDF",
    pdfText: "Создавайте документы в формате PDF.",
    history: "История",
    historyText: "Находите старые сметы и счета.",
    ctaTitle: "Начните бесплатно",
    ctaText:
      "Создайте аккаунт ALEK и подготовьте первые документы за несколько минут.",
    createAccount: "Создать аккаунт",
    tariffs: "Тарифы",
    terms: "Условия",
    privacy: "Конфиденциальность",
    refund: "Возврат",
    contact: "Контакты",
  },

  de: {
    connect: "Anmelden",
    start: "Kostenlos starten",
    badge: "Für Berufstätige in Frankreich entwickelt 🇫🇷",
    hero1: "Schreiben Sie in Ihrer Sprache.",
    hero2: "Arbeiten Sie auf Französisch.",
    intro:
      "ALEK verwandelt Ihre Beschreibung in professionelles Französisch, erstellt Angebote und Rechnungen und spart Ihnen Zeit im Alltag.",
    pricing: "Preise ansehen",
    example: "BEISPIEL",
    exampleInput:
      "Komplette Renovierung eines Badezimmers, Demontage, Sanitärarbeiten, Fliesen und Installation der Ausstattung.",
    professionalQuote: "Professionelles Angebot",
    exampleOutput:
      "Vorbereitung der Baustelle, Demontage der alten Ausstattung, Anpassung der Sanitärleitungen, Verlegung der Fliesen und vollständige Installation der neuen Sanitäreinrichtungen.",
    featuresTitle: "Alles, was Sie für einfacheres Arbeiten brauchen",
    featuresSub:
      "Ein Ort zum Erstellen, Speichern und Versenden Ihrer Dokumente.",
    ai: "KI-Assistent",
    aiText: "Verwandeln Sie Ihre Ideen in professionelles Französisch.",
    devis: "Angebote",
    devisText: "Erstellen Sie klare und professionelle Angebote.",
    invoices: "Rechnungen",
    invoicesText: "Verwandeln Sie ein Angebot schnell in eine Rechnung.",
    siret: "SIRET / SIREN",
    siretText: "Finden Sie Unternehmensinformationen einfacher.",
    pdf: "PDF",
    pdfText: "Erstellen Sie Ihre Dokumente als PDF.",
    history: "Verlauf",
    historyText: "Finden Sie frühere Angebote und Rechnungen.",
    ctaTitle: "Kostenlos starten",
    ctaText:
      "Erstellen Sie Ihr ALEK-Konto und bereiten Sie Ihre ersten Dokumente in wenigen Minuten vor.",
    createAccount: "Konto erstellen",
    tariffs: "Preise",
    terms: "Bedingungen",
    privacy: "Datenschutz",
    refund: "Rückerstattung",
    contact: "Kontakt",
  },

  ar: {
    connect: "تسجيل الدخول",
    start: "ابدأ مجانًا",
    badge: "مصمم للمهنيين العاملين في فرنسا 🇫🇷",
    hero1: "اكتب بلغتك.",
    hero2: "واعمل بالفرنسية.",
    intro:
      "يحوّل ALEK وصفك إلى نص فرنسي احترافي، ويساعدك على إعداد عروض الأسعار والفواتير وتوفير الوقت في عملك اليومي.",
    pricing: "عرض الأسعار",
    example: "مثال",
    exampleInput:
      "تجديد كامل للحمام، إزالة التجهيزات القديمة، أعمال السباكة، البلاط وتركيب المعدات.",
    professionalQuote: "عرض سعر احترافي",
    exampleOutput:
      "تجهيز موقع العمل، إزالة المعدات القديمة، تعديل شبكات السباكة، تركيب البلاط والتركيب الكامل للمعدات الصحية الجديدة.",
    featuresTitle: "كل ما تحتاجه للعمل بسهولة أكبر",
    featuresSub:
      "مساحة واحدة لإنشاء مستنداتك وحفظها وإرسالها.",
    ai: "مساعد الذكاء الاصطناعي",
    aiText: "حوّل أفكارك إلى نص فرنسي احترافي.",
    devis: "عروض الأسعار",
    devisText: "أنشئ عروض أسعار واضحة واحترافية.",
    invoices: "الفواتير",
    invoicesText: "حوّل عرض السعر إلى فاتورة بسرعة.",
    siret: "SIRET / SIREN",
    siretText: "اعثر على معلومات الشركات بسهولة أكبر.",
    pdf: "PDF",
    pdfText: "أنشئ مستنداتك بصيغة PDF.",
    history: "السجل",
    historyText: "اعثر على عروض الأسعار والفواتير السابقة.",
    ctaTitle: "ابدأ مجانًا",
    ctaText:
      "أنشئ حساب ALEK وأعد مستنداتك الأولى خلال دقائق قليلة.",
    createAccount: "إنشاء حساب",
    tariffs: "الأسعار",
    terms: "الشروط",
    privacy: "الخصوصية",
    refund: "الاسترداد",
    contact: "اتصل بنا",
  },
};

const languages: { code: Lang; label: string }[] = [
  { code: "fr", label: "🇫🇷 FR" },
  { code: "ka", label: "🇬🇪 KA" },
  { code: "ru", label: "🇷🇺 RU" },
  { code: "de", label: "🇩🇪 DE" },
  { code: "ar", label: "🇸🇦 AR" },
];

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("fr");
  const t = translations[lang];
  const rtl = lang === "ar";

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
      dir={rtl ? "rtl" : "ltr"}
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
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>

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