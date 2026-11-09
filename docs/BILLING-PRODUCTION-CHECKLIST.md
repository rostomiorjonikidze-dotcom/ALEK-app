# Facturation — checklist avant mise en service

**État actuel : non déployé.** Cette procédure est un prérequis; elle n’autorise pas
à appliquer une migration ou à effectuer un paiement sans l’approbation de
l’exploitant.

## 1. Auditer la base cible et préparer le retour arrière

- Capturer une sauvegarde restaurable et exporter le DDL/RLS/GRANT de `profiles`,
  `auth.users`, les rôles et fonctions Supabase concernés. Comparer le diff de
  [`20261109020000_billing_coordination.sql`](../supabase/migrations/20261109020000_billing_coordination.sql)
  avec le schéma réel et les migrations déjà appliquées. Ne pas supposer que le
  préflight local vaut validation distante.
- Le préflight exige `profiles.id`, `role`, `plan`, `stripe_subscription_id`,
  `stripe_customer_id`, `stripe_subscription_status`, `stripe_price_id`,
  `stripe_updated_at`, `paypal_subscription_id`, `paypal_subscription_status` et
  `subscription_updated_at`. Il ajoute trois tables protégées et des RPC accessibles
  seulement au rôle `service_role`; vérifier les rôles et droits effectifs, les clés
  étrangères `auth.users(id)` et la compatibilité des types avant l’application.
- Tester migration, permissions et `tests/database/billing-coordination.sql` sur une
  copie restaurée de staging. Vérifier les profils utilisateurs/administrateur,
  abonnements Stripe/PayPal actifs, annulés, suspendus et paiements en retard avant
  et après. Ne pas supprimer les nouvelles tables lors d’un rollback applicatif si
  elles contiennent des tentatives ou reçus webhook; préférer rollback du code ou
  correctif SQL forward. Une suppression des tables perd les protections anti-rejeu.
- Déployer par la procédure de migration approuvée du projet, avec une revue humaine
  du SQL, surveillance et plan d’arrêt. N’appliquer ni depuis un test local ni
  directement sur la production sans validation staging et autorisation explicite.

## 2. Configurer l’environnement isolé

Utiliser un projet Supabase et des comptes fournisseurs de test dédiés. Contrôler la
présence (sans imprimer les valeurs) des noms de variables :

- Supabase serveur : `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Stripe test : `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID`.
- PayPal sandbox : `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET`, `PAYPAL_PRO_PLAN_ID`, `PAYPAL_BUSINESS_PLAN_ID`,
  `PAYPAL_WEBHOOK_ID`. Vérifier aussi les alias utilisés dans
  `artisan_paypal_plan_overrides`.

Confirmer directement dans chaque catalogue les tarifs EUR (19,99 € Pro; 49,99 €
Business), le prélèvement mensuel et le mode actif. Utiliser des utilisateurs et
cartes/comptes sandbox; ne jamais réutiliser les prix, clés ou webhooks de production.
N’autoriser qu’un endpoint webhook de test vers l’environnement de test.

## 3. Vérifier les notifications et les cas d’intégration

Configurer Stripe pour envoyer `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.expired`,
`customer.subscription.created|updated|deleted|paused|resumed`, `invoice.paid`,
`invoice.payment_failed`, `charge.refunded` et `charge.dispute.created` vers
`/api/stripe/webhook`. Configurer PayPal sandbox pour
`BILLING.SUBSCRIPTION.CREATED|ACTIVATED|UPDATED|CANCELLED|EXPIRED|SUSPENDED`,
`BILLING.SUBSCRIPTION.PAYMENT.FAILED` et `PAYMENT.SALE.COMPLETED|REFUNDED|REVERSED`
vers `/api/paypal/webhook`.

Avec au moins deux utilisateurs isolés, vérifier :

1. Un checkout Stripe et PayPal ne peuvent pas être créés concurremment pour le même
   utilisateur; une requête simultanée est refusée et aucune seconde ressource
   fournisseur n’est créée.
2. Timeout après envoi, retry dans la fenêtre d’idempotence, expiration de session,
   résultat ambigu et reprise après échéance. Un résultat ambigu ne libère pas le
   verrou; après 20 heures le support doit consulter le fournisseur et résoudre
   explicitement l’essai avant toute nouvelle création.
3. L’identité, le montant EUR, le tarif mensuel, le paiement réussi et la période
   payée sont nécessaires avant accès. Rejouer et réordonner les webhooks; confirmer
   qu’un ancien événement ne remplace pas l’état récent.
4. Échec de renouvellement, remboursement, inversion/litige, résiliation normale et
   résiliation PayPal avant échéance. Confirmer l’absence de nouvel encaissement et
   la conservation de l’accès jusqu’à la seule échéance payée et vérifiée.
5. Tenter de lire/écrire les tables et invoquer les RPC en tant que `anon` et
   `authenticated` (doit échouer), puis vérifier les chemins serveur `service_role`.
6. Rejouer le parcours après restauration d’une sauvegarde et vérifier qu’aucun
   profil, identifiant de fournisseur, abonnement existant ou droit valide n’a été
   perdu.

Surveiller HTTP 5xx des webhooks/RPC, tentatives `unknown`/`manual_review`, conflits
de réservation et différés de réconciliation. Fournir au support une procédure
documentée pour consulter Stripe/PayPal et appeler `billing_resolve_checkout` en
service-role uniquement après avoir établi l’état fournisseur; `pending` requiert
l’ID exact et le lien d’approbation vérifié, `failed` requiert la preuve qu’aucune
ressource facturable n’existe, `complete` requiert la confirmation du paiement et de
l’état du profil. Ne pas exposer une route publique d’administration pour cette
opération.

## 4. Autoriser la promotion séparément

Avant une migration ou activation production, faire approuver : sauvegarde et
restauration, diff du schéma, permission tests, comptes/prix/events sandbox, test de
concurrence à deux providers, support des paiements ambigus, tableau de bord de
surveillance et fenêtre de rollback. Confirmer après déploiement la migration
appliquée et un checkout/test complet avant d’ouvrir le parcours; les validations
locales seules ne constituent pas une preuve de production.
