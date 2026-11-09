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

## Blocages connus — ne pas présenter comme résolus

1. **Pas de verrou durable contre deux intentions concurrentes.** Aucun schéma SQL,
   migration, RPC atomique ou journal de réservation d’abonnement n’est versionné.
   Les gardes sur le profil sont vulnérables à deux requêtes simultanées, notamment
   entre Stripe et PayPal. Les clés idempotentes ne couvrent qu’une opération et une
   identité auprès d’un fournisseur, et leur rétention est limitée. Définir puis
   tester un mécanisme transactionnel après audit du schéma réel ; ne pas inventer
   ni appliquer de migration à la production depuis cette branche.
2. **Cycle de vie PayPal incomplet.** Il n’existe pas de route webhook PayPal dans
   cette version. La synchronisation PayPal à la demande ne garantit pas le suivi
   immédiat des renouvellements, échecs, suspensions, résiliations ou événements
   livrés dans le désordre. Une résiliation PayPal est actuellement envoyée à
   PayPal puis l’accès ALEK peut être retiré dès que son statut devient `CANCELLED`.
   La conservation jusqu’à la fin de période payée nécessite une règle produit et
   des champs de période vérifiés dans le schéma réel ; aucun champ n’est supposé ici.
3. **Rejeu et ordre des événements.** La réconciliation Stripe relit l’état courant,
   mais aucun stockage durable des identifiants d’événement n’est présent. Le statut
   courant réduit le risque de rejouer un ancien événement, sans établir de garantie
   d’ordre transactionnel côté base. Les deux fournisseurs et la base n’ont pas été
   testés dans un environnement d’intégration isolé.
4. **Vérification fournisseur et données de production.** Les montants EUR 19,99 et
   49,99, les identifiants des plans/prix, les clés test, l’URL Stripe webhook, les
   événements activés, l’environnement PayPal, son webhook configuré et les comptes
   de test doivent être vérifiés avant toute activation. Aucune variable du projet
   n’est configurée dans cet environnement. Les abonnements PayPal existants doivent
   être inventoriés et testés sans les modifier.

## Étapes d’intégration contrôlée

1. Préparer un environnement de test isolé et des comptes test des deux fournisseurs;
   vérifier les prix EUR et périodes mensuelles directement dans leurs catalogues.
2. Utiliser des livraisons webhook de test valides et invalides, répétées et
   désordonnées; vérifier refus de signature, renouvellement payé/échoué, suspension,
   annulation et reprise. Pour PayPal, enregistrer le webhook dans le compte test,
   configurer son identifiant côté serveur et vérifier sa signature par l’API PayPal
   avant tout traitement. Valider ensuite le webhook depuis le compte de production
   séparément, sans y créer de paiement de test.
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
