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
- L’édition/suppression est autorisée uniquement pour le type connu `devis`. Les
  requêtes d’écriture ajoutent aussi le filtre `document_type = devis`, le propriétaire
  et vérifient qu’une ligne a bien été retournée. Aucun changement de facture ne passe
  par le formulaire.
- L’export d’une facture enregistrée reconstruit les données depuis la ligne enregistrée
  du compte actif (identités, dates, prestations et montants persistés), pas depuis les
  champs de saisie modifiables. Une incohérence d’identifiant de compte bloque l’export.
- Les bibliothèques jsPDF/AutoTable et les deux polices intégrées sont chargées à la
  demande, au premier export. Le générateur PDF partagé est testé avec une facture
  synthétique accentuée, les polices locales, un tableau paginé et les octets PDF produits.
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
- Les clés de stockage local séparées par compte limitent l’affichage accidentel du
  brouillon d’un autre compte ; elles ne chiffrent pas les données. Toute personne ayant
  accès au même profil navigateur ou à ses outils de développement peut lire les clés.
  Sur un appareil partagé, se déconnecter et ne pas enregistrer de données sensibles
  dans le brouillon. Aucun effacement automatique ni chiffrement n’est ajouté sans
  contrat de stockage et de récupération approuvé.
- Le PDF synthétique ne remplace pas la revue d’exports réels : contrôler les PDF courts
  et longs, toutes les identités et clauses, les montants comparés aux données stockées,
  ainsi que les langues conservées et le parcours connecté sur navigateur mobile.

## Vérification exécutée pour ces changements

Vérifié sur la branche : `npm test` (62 tests), `npm run lint`, `npm run typecheck`,
`npm run build`, et `git diff --check`. Le test `tests/pdf-runtime.test.mjs` exécute le
générateur partagé avec une facture de démonstration, vérifie `%PDF-`, la taille des
octets produits et plusieurs pages. Ce fixture inclut notamment les champs
`document_type`, `document_number`, `document_date`, `due_date`, `client_name`,
`business_name`, `services`, `total_ht`, `total_vat`, `total_ttc`, `vat_rate` et
`invoice_status`. Ces contrôles ne prouvent ni les politiques RLS effectives ni une
conformité juridique.

## Vérification manuelle proposée au parent

Sur `/dashboard`, fournir au mock une session Supabase persistante et une réponse
`profiles` pour l’utilisateur connecté, puis des `documents` synthétiques comprenant
une facture et un devis avec les champs ci-dessus et `id`, `user_id`, `client_address`,
`business_address`, `services`, `vat_exempt`, `client_is_professional`, `payment_terms`,
`payment_method`, `devis_reference`. Vérifier l’ouverture de la facture en consultation,
les champs inertes, l’absence de suppression et l’export basé sur les valeurs persistées,
puis le devis modifiable/supprimable. Simuler les routes Supabase Auth (`/auth/v1/user`,
`/auth/v1/token` ou l’état de session du navigateur), REST `/rest/v1/profiles`,
`/rest/v1/documents` (GET/PATCH/DELETE), et RPC
`/rest/v1/rpc/issue_artisan_document_v2`; renvoyer une ligne mise à jour/supprimée
uniquement si les filtres incluent l’ID, le `user_id` actif et `document_type=devis`.
Un second compte doit avoir une autre facture/devis et un brouillon distinct.
Ces routes simulées valident le client seulement, jamais Supabase RLS.
