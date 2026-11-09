# ALEK Artisan

Application Next.js (App Router) de devis, factures et gestion documentaire pour les
professionnels en France : assistant IA de rédaction, génération de PDF, suivi financier,
signature simple de devis et gestion des abonnements PayPal.

## Prérequis

- Node.js 22+
- Un projet Supabase (authentification + tables `profiles`, `documents`,
  `artisan_clients`, `artisan_catalog`, `artisan_expenses`, `artisan_signature_requests`
  et les fonctions RPC `issue_artisan_document_v2`, `reserve_ai_usage` / `refund_ai_usage`)
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
| `npm test` | Tests hors ligne : authentification, documents, paiements et validation |

## Tests

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm start
# Dans un autre terminal :
ALEK_BASE_URL=http://127.0.0.1:3000 node --test tests/public-smoke.test.mjs
```

Les tests de paiement utilisent des services simulés et ne lancent aucun paiement.
La CI vérifie le build de la branche localement, sans appeler la production.

Le paiement par carte nécessite également les variables Stripe de `.env.example`.
Les clés publiques sont intégrées au build ; utilisez une configuration de test
isolée pour vérifier les parcours connectés. La livraison des e-mails et les URL
Supabase autorisées se configurent dans le service d'authentification.

Voir [le rapport d'audit](docs/AUDIT-2026-11-09.md) pour les corrections, les limites
vérifiées et les prérequis de déploiement. Aucun schéma SQL ni politique RLS n'est
fourni actuellement : ne présumez pas que les contrôles du navigateur protègent
les données ou garantissent la numérotation.
