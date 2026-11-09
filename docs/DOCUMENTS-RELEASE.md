# Documents — limites et vérifications avant version de production

## Changements de cette branche

- Les factures déjà enregistrées sont présentées en consultation uniquement : les
  contrôles d’édition sont rendus inertes, l’enregistrement de modifications est
  bloqué et l’action de suppression n’est pas proposée. L’export PDF reste disponible.
- La sauvegarde d’une nouvelle facture appelle `issue_artisan_document_v2` et attribue
  immédiatement un numéro : elle émet donc le document, elle ne crée pas un brouillon
  serveur. Les brouillons de saisie restent locaux, mais sont maintenant séparés par
  identifiant Supabase. La clé historique `alek-draft-v2` sans propriétaire est laissée
  intacte et ignorée. Une migration n’est faite que si cette ancienne donnée contient
  déjà un `user_id` correspondant exactement au compte connecté.
- Les bibliothèques jsPDF/AutoTable et les deux polices intégrées sont chargées à la
  demande, au premier export. Un test génère un PDF synthétique avec accents français,
  les polices locales et un tableau.
- Les contrôles communs signalent les taux de TVA hors plage et les dates ISO invalides
  ou incohérentes. Ils ne certifient ni le régime fiscal ni la conformité légale.

## Limites qui exigent le vrai schéma et un environnement autorisé

- Aucun schéma SQL, migration, trigger ou politique RLS n’est versionné ici. Les
  protections de l’interface sont contournables par un client modifié et ne rendent
  pas les factures immuables côté serveur. Avant publication, obtenir la définition
  réelle de `documents` et de `issue_artisan_document_v2`, puis vérifier avec deux
  comptes de test les propriétaires, insertions, lectures, mises à jour, suppressions,
  numéros et idempotence.
- Le modèle connu ne décrit pas de statut brouillon, d’archive, de lien entre facture
  et avoir ni de procédure de correction. Aucun avoir ni archivage n’est ajouté :
  inventer des colonnes ou détourner `invoice_status` risquerait d’altérer les pièces.
- Toutes les factures déjà présentes sont considérées émises et verrouillées dans
  l’interface. Les devis gardent leur comportement existant ; le statut de paiement
  d’une facture existante devient également non modifiable ici.
- Aucune modification de base de données, donnée réelle, API externe ou configuration
  de production n’a été effectuée. Les données de brouillon historiques sans propriétaire
  restent dans le stockage local du navigateur afin de ne pas les attribuer au mauvais
  compte ; l’exploitant devra décider de leur traitement avant de les retirer.
- Le PDF synthétique ne remplace pas la revue d’exports réels : contrôler les PDF courts
  et longs, toutes les identités et clauses, les montants comparés aux données stockées,
  ainsi que les langues conservées et le parcours connecté sur navigateur mobile.

## Vérification exécutée pour ces changements

Exécuter `node --experimental-strip-types --test tests/document-drafts.test.mjs
tests/document-policy.test.mjs tests/pdf-runtime.test.mjs` et la suite `npm test`.
Les premiers tests isolent le stockage et les politiques d’interface ; le test PDF ne
fait qu’assembler une pièce synthétique hors ligne. Exécuter également lint, typecheck
et build de production sur la révision intégrée. Aucun de ces contrôles ne prouve les
politiques RLS effectives ni une conformité juridique.
