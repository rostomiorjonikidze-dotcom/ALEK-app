# ALEK Artisan

Application Next.js (App Router) de devis, factures et gestion documentaire pour les
professionnels en France : assistant IA de rédaction, génération de PDF, suivi financier,
signature simple de devis et gestion des abonnements PayPal.

## Prérequis

- Node.js 22+
- Un projet Supabase (authentification + tables `profiles`, `documents`,
  `artisan_clients`, `artisan_catalog`, `artisan_expenses`, `artisan_signature_requests`
  et les fonctions RPC `reserve_ai_usage` / `refund_ai_usage`)
- Une clé API Groq pour l'assistant IA
- Des identifiants PayPal (sandbox ou live) pour les abonnements

## Installation

```bash
npm ci
cp .env.example .env.local
# renseignez les valeurs dans .env.local
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

Voir [.env.example](.env.example). Aucune valeur secrète ne doit être commitée.

| Variable | Portée | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + serveur | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur uniquement | Accès administration Supabase |
| `GROQ_API_KEY` | serveur uniquement | Clé API Groq |
| `GROQ_VISION_MODEL` | serveur | Modèle vision (photos, reçus) |
| `PAYPAL_ENV` | serveur | `sandbox` ou `live` |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | serveur | Identifiants PayPal |
| `PAYPAL_PRO_PLAN_ID` / `PAYPAL_BUSINESS_PLAN_ID` | serveur | Plans d'abonnement vérifiés |

Le build ne nécessite aucune variable : le client Supabase navigateur est créé à la
première utilisation (voir `app/lib/supabase.ts`).

## Scripts

| Commande | Description |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm start` | Serveur de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` puis `tsc --noEmit` |
| `npm test` | Tests des modèles de conformité française |

## Tests

- `tests/pro-compliance.test.mjs` — modèles de conformité (exécutable hors ligne).
- `tests/public-smoke.test.mjs` — vérifie les pages publiques déployées et le contrôle
  d'authentification de `/api/ai`. Lancez-le après un déploiement :

```bash
ALEK_BASE_URL=https://app.alek.best node --test tests/public-smoke.test.mjs
```

Les deux suites tournent dans GitHub Actions (`.github/workflows/public-smoke.yml`), avec
en plus `lint`, `typecheck` et `build`.
