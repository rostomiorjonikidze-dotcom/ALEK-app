# Prérequis de mise en service de la facturation

Ce document complète l’audit du 9 novembre 2026. Les changements de code restent
testés hors ligne : aucun secret ou paramètre fournisseur n’est configuré ici et
aucun paiement, abonnement, changement de catalogue ou appel à une base réelle
n’a été effectué.

## Corrections vérifiables dans le code

- Stripe conserve le parcours Checkout intégré, vérifie le tarif mensuel EUR côté
  serveur et n’active les droits qu’après vérification fournisseur du paiement et
  de l’abonnement. Les webhooks Stripe ont une signature HMAC et fenêtre temporelle
  vérifiées ; la réconciliation relit le statut courant chez Stripe. La résiliation
  carte est programmée en fin de période payée (`cancel_at_period_end`) et ne retire
  donc pas immédiatement l’accès Stripe.
- Les requêtes de création d’abonnement et de résiliation réutilisent une clé
  d’idempotence stable par fournisseur, opération et identité (clé PayPal de 37
  caractères, sous sa limite documentée). Cela protège les répétitions de la même
  requête pendant la rétention de clé du fournisseur ; ce n’est pas un verrou
  transactionnel ni une déduplication inter-fournisseurs.
- La synchronisation PayPal conserve désormais le plan Stripe actif au lieu de le
  remplacer par un autre niveau PayPal. Les profils et abonnements PayPal existants
  ne sont ni effacés ni migrés par ce changement.
- Une route `POST /api/paypal/webhook` vérifie chaque notification auprès de
  `POST /v1/notifications/verify-webhook-signature` avec les cinq en-têtes PayPal,
  l’identifiant `PAYPAL_WEBHOOK_ID` configuré et l’objet événement reçu. Après
  vérification réussie, elle retrouve uniquement le profil dont
  `paypal_subscription_id` correspond exactement à l’ID de la notification, relit
  l’abonnement courant depuis PayPal, contrôle son ID et `custom_id`, puis met à
  jour les champs de profil déjà employés par la synchronisation. Un ancien
  événement ne peut donc pas restaurer l’état périmé qu’il transporte ni remplacer
  un abonnement plus récent; une notification répétée réconcilie le même état
  courant sans nouvelle action métier.

## Blocages connus — ne pas présenter comme résolus

1. **Pas de verrou durable contre deux intentions concurrentes.** Aucun schéma SQL,
   migration, RPC atomique ou journal de réservation d’abonnement n’est versionné.
   Les gardes sur le profil sont vulnérables à deux requêtes simultanées, notamment
   entre Stripe et PayPal. Les clés idempotentes ne couvrent qu’une opération et une
   identité auprès d’un fournisseur, et leur rétention est limitée. Définir puis
   tester un mécanisme transactionnel après audit du schéma réel ; ne pas inventer
   ni appliquer de migration à la production depuis cette branche.
2. **État de paiement PayPal vs statut d’abonnement.** Le webhook ne déduit pas une
   période payée d’un événement `PAYMENT.SALE.*` : il synchronise seulement le statut
   courant renvoyé par l’API d’abonnement. Une notification d’échec de paiement dont
   l’abonnement reste encore `ACTIVE` ne peut donc pas être interprétée comme une
   suspension ni comme une fin de période. Le schéma connu ne fournit pas de période
   payée jusqu’à ni de statut de paiement persistant; aucune révocation immédiate ou
   conservation jusqu’à échéance n’est inventée. Les événements PayPal de
   remboursement et d’inversion ne sont pas utilisés pour accorder ou retirer des
   droits. La route PayPal de résiliation existante peut encore retirer les droits
   dès confirmation de `CANCELLED`; une politique de fin de période exige des données
   de période vérifiées et une décision produit.
3. **Rejeu et ordre des événements.** Le webhook PayPal relit l’état du fournisseur
   et ignore les événements dont l’abonnement n’est plus celui du profil; les
   répétitions sont idempotentes au niveau de l’état réconcilié. Aucun journal
   durable d’identifiants d’événements, aucune transaction atomique fournisseur/base
   et aucun verrou de profil ne sont présents. Stripe et PayPal n’ont pas été testés
   dans un environnement d’intégration isolé.
4. **Vérification fournisseur et données de production.** Les montants EUR 19,99 et
   49,99, les identifiants des plans/prix, les clés test, l’URL Stripe webhook, les
   événements activés, l’environnement PayPal, son webhook configuré et les comptes
   de test doivent être vérifiés avant toute activation. Aucune variable du projet
   n’est configurée dans cet environnement. Les abonnements PayPal existants doivent
   être inventoriés et testés sans les modifier.

## Étapes d’intégration contrôlée

1. Préparer un environnement de test isolé et des comptes test des deux fournisseurs;
   vérifier les prix EUR et périodes mensuelles directement dans leurs catalogues.
2. Enregistrer `https://app.alek.best/api/paypal/webhook` dans le compte PayPal de
   test, configurer son identifiant dans `PAYPAL_WEBHOOK_ID` et souscrire aux
   événements `BILLING.SUBSCRIPTION.CREATED`, `ACTIVATED`, `UPDATED`, `CANCELLED`, `EXPIRED`,
   `SUSPENDED`, `PAYMENT.FAILED` et `PAYMENT.SALE.COMPLETED`. Utiliser des livraisons
   de test valides et invalides, répétées et désordonnées; vérifier le refus de
   signature et que l’état enregistré suit toujours la lecture courante PayPal.
   Tester séparément l’échec de renouvellement tant que le statut PayPal reste actif.
   Valider ensuite la configuration depuis le compte de production sans y créer de
   paiement de test.
3. Tester avec deux comptes utilisateurs séparés que la synchronisation n’accorde
   aucun droit à un autre compte, que l’annulation conserve les droits déjà payés
   selon la politique décidée et qu’un événement répété ne crée aucun effet nouveau.
4. Concevoir et faire réviser le verrou durable contre les doubles souscriptions à
   partir du schéma sauvegardé réel. Vérifier sa concurrence en base de test, y
   compris les deux fournisseurs; ne pas confondre avec les clés d’idempotence.
5. Documenter la reprise opérateur, l’observation des échecs webhooks et la
   réconciliation avant d’autoriser une activation graduelle. Ne pas déployer ni
   lancer de transaction depuis les tests hors ligne.

Références de comportement fournisseur : [idempotence Stripe](https://docs.stripe.com/api/idempotent_requests),
[création d’abonnement PayPal et rétention `PayPal-Request-Id`](https://developer.paypal.com/api/subscriptions/v1/subscriptions-create),
[vérification de signature webhook PayPal](https://developer.paypal.com/api/webhooks/v1/verify-webhook-signature-post).
