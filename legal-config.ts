export const LEGAL = {
  brand: "ALEK",
  website: "https://app.alek.best",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@alek.best",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "À compléter avant mise en production",
  postalAddress:
    process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "À compléter avant mise en production",
  country: "France",
  updatedAt: "11 septembre 2026",
} as const;
