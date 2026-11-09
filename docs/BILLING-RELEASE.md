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
  caractères, sous sa limite documentée). La clé de checkout ne comprend pas le
  niveau choisi : Stripe rejette la réutilisation avec des paramètres différents;
  PayPal peut rejouer l’abonnement initial. ALEK demande donc la représentation
  complète et vérifie `id`, `plan_id` et `custom_id` avant de fournir le lien
  d’approbation; une formule précédente rejouée produit un HTTP 409 sans URL. Il
  faut terminer/annuler la demande en attente ou contacter le support, pas approuver
  ce lien ni supposer qu’un changement de formule a été pris en compte. Stripe
  conserve les clés au moins 24 h et PayPal 72 h; ces fenêtres ne sont pas des
  verrous durables.
- La synchronisation PayPal conserve désormais le plan Stripe actif au lieu de le
  remplacer par un autre niveau PayPal, et retient le plus haut niveau payé si les
  deux fournisseurs ont un abonnement actif (`business` > `pro` > `free`). La
  réconciliation Stripe relit aussi l’abonnement PayPal actif et résout son niveau
  avec les plans configurés et les alias `artisan_paypal_plan_overrides`, au lieu
  d’inférer le niveau PayPal depuis le champ partagé `profiles.plan`. Les profils,
  identifiants et abonnements PayPal existants ne sont ni effacés ni migrés.
- Une route `POST /api/paypal/webhook` vérifie chaque notification auprès de
  `POST /v1/notifications/verify-webhook-signature` avec les cinq en-têtes PayPal,
  l’identifiant `PAYPAL_WEBHOOK_ID` configuré et l’objet événement reçu. Après
  vérification réussie, elle retrouve uniquement le profil dont
  `paypal_subscription_id` correspond exactement à l’ID de la notification, relit
  l’abonnement courant depuis PayPal, contrôle son ID et `custom_id`, puis met à
  jour les champs de profil déjà employés par la synchronisation. Un ancien
  événement ne peut donc pas restaurer l’état périmé qu’il transporte ni remplacer
  un identifiant d’abonnement différent déjà lié au profil. La notification sert
  uniquement à déclencher une relecture de l’état fournisseur, son contenu de statut
  n’est pas appliqué directement. Cette relecture aide contre un payload ancien,
  mais ne garantit pas la sécurité d’événements désordonnés ou concurrents : deux
  traitements simultanés du même abonnement peuvent lire des états successifs puis
  écrire dans l’ordre inverse. Sans verrou/CAS disponible dans le schéma, aucune
  garantie de sérialisation n’est revendiquée.

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
   et ignore les événements dont l’abonnement n’est plus celui du profil; relire
   l’état courant évite d’appliquer directement les champs périmés du payload, mais
   ne suffit pas à assurer la sûreté concurrente. Le filtre exact sur
   `paypal_subscription_id` empêche seulement une écriture si le profil est déjà
   associé à un autre ID. Deux traitements qui lisent le même ID peuvent lire des
   états courants différents puis écrire à l’envers. La réconciliation Stripe a la
   même course pour un même ID. Aucun journal durable d’identifiants d’événement,
   CAS ni verrou de profil ne sont disponibles dans le schéma fourni. Stripe et
   PayPal n’ont pas été testés dans un environnement d’intégration isolé.
   Le niveau d’accès est stocké dans le champ partagé `profiles.plan`; relire les
   deux fournisseurs et choisir le niveau maximal ne protège pas de ces écritures
   concurrentes. Un mécanisme transactionnel/CAS basé sur le schéma réel est requis.
4. **Vérification fournisseur et données de production.** Les montants EUR 19,99 et
   49,99, les identifiants des plans/prix, les clés test, l’URL Stripe webhook, les
   événements activés, l’environnement PayPal, son webhook configuré et les comptes
   de test doivent être vérifiés avant toute activation. Aucune variable du projet
   n’est configurée dans cet environnement. Les abonnements PayPal existants doivent
   être inventoriés et testés sans les modifier.

## Étapes d’intégration contrôlée

1. Préparer un environnement de test isolé et des comptes test des deux fournisseurs;
   vérifier les prix EUR et périodes mensuelles directement dans leurs catalogues.
2. Enregistrer `https://<hôte-de-test-isolé>/api/paypal/webhook` dans le compte
   PayPal sandbox, configurer son identifiant dans `PAYPAL_WEBHOOK_ID` et souscrire
   aux événements `BILLING.SUBSCRIPTION.CREATED`, `BILLING.SUBSCRIPTION.ACTIVATED`,
   `BILLING.SUBSCRIPTION.UPDATED`, `BILLING.SUBSCRIPTION.CANCELLED`,
   `BILLING.SUBSCRIPTION.EXPIRED`, `BILLING.SUBSCRIPTION.SUSPENDED`,
   `BILLING.SUBSCRIPTION.PAYMENT.FAILED` et `PAYMENT.SALE.COMPLETED`. Ne pas pointer
   les livraisons sandbox vers le site de production. Utiliser des événements de
   test valides et invalides, répétés et désordonnés; vérifier le refus de signature
   et que l’état enregistré suit une relecture PayPal. Tester aussi explicitement
   deux réconciliations chevauchantes pour documenter l’absence de sérialisation.
   Tester séparément l’échec de renouvellement tant que le statut PayPal reste actif.
   La configuration de production devra être établie séparément dans son propre
   compte et son propre endpoint, après préparation contrôlée.
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
