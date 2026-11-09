import { SITE_URL } from "./lib/site-url";

export const LEGAL = {
  brand: "ALEK",
  website: SITE_URL,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@alek.best",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "EI ALEK",
  postalAddress:
    process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "22 rue Jean Martin, 13005 Marseille, France",
  country: "France",
  updatedAt: "1 novembre 2026",
} as const;
