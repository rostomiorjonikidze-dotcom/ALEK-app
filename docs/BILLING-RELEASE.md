# Revue de mise en service — facturation

Le parcours utilise Stripe Checkout intégré et PayPal Subscriptions. Le verrouillage,
les états d’abonnement et la déduplication des notifications sont maintenant portés
par la migration additive
[`20261109020000_billing_coordination.sql`](../supabase/migrations/20261109020000_billing_coordination.sql).
La migration **n’a pas été appliquée à une base de projet ou de production**. Aucun
secret fournisseur n’a été utilisé et aucun paiement ni abonnement réel/test n’a été
créé depuis cette tâche.

## Changements vérifiables

- Une réservation transactionnelle unique par utilisateur empêche les créations
  concurrentes chez Stripe et PayPal. Les tentatives ont une clé fournisseur durable,
  une fenêtre de reprise de 20 heures et un compteur de fencing; un résultat réseau
  ambigu n’est jamais automatiquement libéré. Après la fenêtre, une vérification
  opérateur est requise. Un accès payé encore valide bloque aussi un nouveau checkout,
  y compris après résiliation anticipée.
- La création, la reprise d’une session en attente et la fermeture d’une tentative
  utilisent les RPC de service-role. Les réponses périmées d’un worker ne peuvent
  modifier un verrou renouvelé.
- La réconciliation Stripe/PayPal écrit les états et `profiles.plan` dans une même
  transaction, conserve l’accès jusqu’à la période payée après résiliation, et
  n’accorde pas un nouvel accès sans montant, devise, périodicité et preuve de
  paiement vérifiés. Les remboursements/inversions bloquent le droit jusqu’à un
  nouveau paiement réussi.
- Le journal d’événements déduplique les notifications; les dates fournisseur empêchent un
  événement plus ancien d’écraser l’état plus récent. Les profils restent la surface
  de lecture historique utilisée par l’application. Aucun abonnement ou profil
  PayPal existant n’est effacé.
- Les RPC et tables de coordination sont interdits à `anon` et `authenticated`; les
  opérations passent par le serveur avec le rôle `service_role`.

## Contrôles faits hors production

- Migration appliquée à un PostgreSQL 16 isolé avec un schéma Supabase synthétique;
  le contrat SQL `tests/database/billing-coordination.sql` passe (réservation,
  cross-provider, fencing, rejeu, ordre, remboursement, résiliation et privilèges),
  y compris avec le trigger de protection des profils existant.
- Deux appels PostgreSQL concurrents donnent une seule réservation : l’autre requête
  reçoit `busy` pour le même fournisseur ou `conflict` entre fournisseurs.
- `npm test`, `npm run typecheck` et `npm run lint` passent.
- Aucune vérification navigateur, sandbox fournisseur, webhooks réels ou schéma
  Supabase effectif n’a été faite. L’intégration UI est donc encore à vérifier dans
  le Preview géré après intégration.

## Mise en service

Suivre [`BILLING-PRODUCTION-CHECKLIST.md`](./BILLING-PRODUCTION-CHECKLIST.md) avant
toute migration ou activation. Le préflight SQL exige notamment les colonnes exactes
de `profiles`; cette vérification locale ne remplace pas l’audit du schéma distant,
des RLS/GRANT existants, des clients Supabase générés ou des règles métier. Déployer
d’abord en staging sauvegardé, valider les deux fournisseurs et observer les erreurs
RPC/webhooks; promotion production distincte avec approbation humaine requise.

## Références fournisseur

- [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests)
- [PayPal Subscriptions — création](https://developer.paypal.com/api/subscriptions/v1/subscriptions-create)
- [PayPal webhook signature verification](https://developer.paypal.com/api/webhooks/v1/verify-webhook-signature-post)
- [PayPal subscription billing information](https://developer.paypal.com/api/subscriptions/v1/definitions/subscription_billing_info)
