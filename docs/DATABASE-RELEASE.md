# Base Supabase — preuves exigées avant livraison

## État constaté

Le dépôt ne contient pas le schéma SQL déployé, les migrations, les politiques RLS,
les déclencheurs ni le corps des RPC. Aucune connexion à une base n'a été effectuée.
Les contrôles applicatifs et tests simulés ne prouvent pas la sécurité effective
Supabase. **La livraison reste bloquée sur cette vérification.** Aucun SQL de création,
modification, migration ou reprise des données n'est proposé sans ce contrat réel.

Tables référencées par le code : `profiles`, `documents`, `artisan_clients`,
`artisan_catalog`, `artisan_expenses`, `artisan_signature_requests`,
`artisan_paypal_plan_overrides`. RPC observées :
`issue_artisan_document_v2`, `reserve_ai_usage`, `refund_ai_usage`.
Ces noms décrivent des appels existants, pas une preuve de leur présence ou définition.

## Collecte et procédure sûre

1. Le propriétaire de la base fournit les migrations existantes et une extraction
   **du schéma uniquement**. Préférer une copie isolée sans données clients. Ne pas
   communiquer de mot de passe ni de clé de service dans la PR.
2. Sur cette copie, exécuter `docs/database/inspect-schema.sql` : transaction en lecture
   seule, catalogue PostgreSQL uniquement, aucune lecture de ligne client. Le script
   n'a pas été exécuté ici. Relire et expurger les secrets éventuels des fonctions,
   valeurs par défaut et commentaires avant de versionner une extraction.
3. Reconstituer le schéma confirmé dans un Supabase de test, avec deux comptes A/B
   et des documents fictifs. Aucun test ci-dessous ne doit viser la production.
4. Tester les accès directs PostgREST/RPC avec les JWT **anon et authenticated**,
   jamais seulement avec la clé service qui contourne RLS. Un filtre `user_id` de
   navigateur n'est pas une frontière de sécurité.

## Matrice d'acceptation (non exécutée)

| Surface | Résultats exigés dans la base isolée |
| --- | --- |
| Toutes les tables privées | Anonyme : aucune donnée. A ne peut lire, insérer pour, modifier, supprimer ni transférer les lignes de B, même en changeant `user_id`, les clés étrangères ou les paramètres RPC. |
| `profiles` | Aucun utilisateur ne peut changer son rôle, plan, compteurs, identifiants client/abonnement, statut ou dates de facturation. Les champs de profil autorisés doivent avoir des droits explicites séparés. |
| `documents` | Une facture émise ne peut être modifiée ni supprimée par REST ou RPC. Séparer le suivi de règlement des champs fiscaux immuables. Contrôler aussi les changements de type pour contourner la protection. |
| Émission | Allocation atomique et unicité des numéros dans le périmètre légal validé, dates chronologiques, absence de réutilisation, émission liée à `auth.uid()`, totaux calculés/vérifiés côté serveur. Simuler émission concurrente et perte de réponse réseau ; une relance ne doit pas créer une deuxième facture. |
| Brouillon/avoir/archive | Confirmer les états réels avant d'ajouter des colonnes. Définir transaction de finalisation, avoir numéroté référençant la facture et conservation non destructive. Aucun faux type `avoir` ni indicateur d'archive n'a été ajouté sans schéma. |
| Quotas IA | Réservation atomique, appels concurrents, remboursement borné/idempotent et impossible pour un autre compte. Interdire à un utilisateur de s'accorder du quota par un appel direct à `refund_ai_usage`. |
| Signatures | Le client ne peut altérer token/hash/snapshot/consentement ni signer avec ses droits SQL ordinaires. Les routes serveur filtrent le propriétaire pour création/liste et le token haché pour acceptation. Le changement pending → signed doit être atomique, avec snapshot et expiration inchangés. |
| Fonctions SECURITY DEFINER | Droits EXECUTE minimaux (révoquer PUBLIC si inadapté), `search_path` sûr, propriétaire adapté, identité appelant vérifiée. Vérifier aussi fonctions non citées mais exposées par PostgREST. |
| Vues, stockage et Realtime | Vérifier les vues exposées, les abonnements temps réel et tous les buckets réellement présents ; aucun inventaire de stockage n'est disponible ici. Ne pas supposer que RLS sur une table couvre ces autres accès. |
| Abonnements | Verrou durable par utilisateur commun aux deux fournisseurs ; tentative/idempotence persistées avant appel fournisseur ; reprise après panne et événements désordonnés. Les gardes UI et idempotences fournisseur seules ne suffisent pas. |

Conserver les requêtes, statuts et assertions expurgés de chaque cas comme artefacts CI.
Une migration corrective, un plan de sauvegarde/restauration et l'approbation explicite
pour toute modification en production ne pourront être préparés qu'après examen du
schéma réel. Aucune conformité fiscale, juridique ou eIDAS n'est certifiée par ces tests.
