# Protection des factures et émission SQL

## Portée et état

Cette préparation cible le contrat observé dans ALEK : `public.documents`, RLS et
politiques CRUD existantes, les types `facture`/`devis`, les prestations JSON
`{description,type,priceType,quantity,price,hours}`, les totaux en colonnes et les
RPC `issue_artisan_document(jsonb)` / `issue_artisan_document_v2(jsonb)`. Elle ne
modifie aucune ligne déjà enregistrée, ne recrée pas le numéro des documents et ne
remplace pas l'index unique existant sur `(user_id, document_type, document_number)`.

Les définitions effectives de la table et des fonctions ne sont pas présentes dans
ce dépôt et aucune connexion Supabase n'était disponible. La migration est donc
**conditionnelle, à examiner contre les métadonnées et corps SQL réels avant toute
application**. Son précontrôle échoue au lieu de deviner en cas de type, index,
signature, propriétaire, privilège ou politique inattendu. Elle n'a pas été appliquée
à Supabase ni à la production.

Le seul fichier de migration est conçu pour s'appliquer dans une transaction :

- `supabase/migrations/20261109010100_invoice_immutability_and_legacy_rpc_lock.sql`

L'ancienne interface v1/v2 est désactivée pour tous les rôles API au commit de la
migration; la nouvelle v3 doit être disponible dans la même transaction.

## Garanties ajoutées si le précontrôle et la revue passent

- Une facture numérotée existante ne peut être ni supprimée, ni transférée en devis,
  ni modifiée hors `invoice_status`. L'état du paiement reste un champ distinct, et
  seules les valeurs app observées `unpaid`, `pending` et `paid` sont admises lors
  d'un changement. Les factures numérotées commencent `unpaid`.
- Un numéro de facture ne peut pas être inséré ou attribué par PostgREST, y compris
  via `service_role`; les factures sans numéro restent des brouillons modifiables.
  Les devis gardent les droits CRUD/RLS actuels.
- Les RPC v1/v2 ne sont plus exécutables par les rôles API. Un rôle
  `alek_invoice_issuer` non-connectable, sans appartenance de rôle ni `BYPASSRLS`,
  possède uniquement les deux fonctions historiques, le validateur et le nouveau
  point d'entrée. Une politique RLS limitée à ce rôle permet l'émission; un trigger
  n'autorise les insertions numérotées qu'à ce rôle. Le propriétaire de la base garde
  nécessairement les pouvoirs d'administration PostgreSQL.
- `issue_artisan_document_v3(p_payload jsonb)` vérifie `auth.uid()` et le propriétaire,
  exige `request_id` UUID, date et échéance, valide les lignes, prix, quantités,
  heures et régime/taux de TVA, puis recalcule HT/TVA/TTC côté serveur. Le calcul
  reproduit l'arrondi monétaire JavaScript du client par ligne, puis sur les totaux.
  Les taux acceptés reflètent les options actuelles du formulaire (0, 5,5, 10, 20 %);
  une exemption déclarée exige 0 %. Aucun taux par ligne n'est pris en charge par le
  format actuel.
- Le numéro transmis par le navigateur est supprimé et la fonction historique doit
  attribuer le numéro. L'enregistrement est vérifié contre la ligne persistée, le
  propriétaire, le document unique et les montants recalculés. Toute différence fait
  échouer et annule la transaction. Un verrou consultatif transactionnel par
  utilisateur sérialise les appels concurrents sans remplacer l'algorithme existant
  de numérotation ni l'index unique.
- La table d'idempotence conserve l'UUID propriétaire/clé, un SHA-256 du contenu
  normalisé et le résultat `{id, document_number}`, pas les coordonnées ou le contenu
  client. Même clé et même contenu renvoient le résultat initial; même clé et contenu
  différent est rejeté. Les erreurs annulent l'enregistrement de la clé et la pièce.

Ce mécanisme ne crée pas le flux d'avoir manquant : une correction après émission
nécessite un avoir numéroté et lié, mais le dépôt ne décrit aucun schéma ou RPC pour
ce workflow. Ne pas modifier la facture originale, inventer un type `avoir`, ni
considérer `invoice_status` comme statut d'archive. Le besoin d'avoir reste bloqué
jusqu'à l'approbation du schéma et du processus métier correspondant.

## Contrat d'appel à intégrer côté client

Remplacer `issue_artisan_document_v2` par `issue_artisan_document_v3` et transmettre
un `request_id` UUID dans `p_payload`. Générer et persister l'identifiant avant le
premier envoi (dans le brouillon courant) et la réutiliser pour toute relance après
timeout/perte de réponse; une nouvelle émission intentionnelle reçoit une nouvelle
clé. Ne jamais générer une nouvelle clé seulement parce que le résultat réseau est
inconnu. Le champ `document_number` fourni est ignoré; conserver le numéro retourné.
Le résultat reste `{id, document_number}`, compatible avec le lecteur existant.

Exemple de propriétés ajoutées au payload courant :

```json
{
  "request_id": "10000000-0000-0000-0000-000000000001",
  "user_id": "00000000-0000-0000-0000-000000000001",
  "document_type": "facture",
  "document_date": "2026-11-09",
  "due_date": "2026-12-09",
  "services": [{
    "description": "Prestation",
    "type": "labor",
    "priceType": "hourly",
    "quantity": 1,
    "hours": 2.5,
    "price": 35
  }],
  "total_ht": 87.5,
  "total_vat": 17.5,
  "total_ttc": 105,
  "vat_rate": 20,
  "vat_exempt": false
}
```

Ne pas déployer le client actuel après cette migration sans adaptation : il appelle
v2 et n'envoie pas de clé. Coordonner l'application atomique de la migration et le
déploiement du client v3 dans une fenêtre contrôlée; maintenir l'ancien RPC pendant
une période de compatibilité réintroduirait le contournement de validation.

## Portes de pré-déploiement obligatoires

1. Prendre une sauvegarde récupérable et relever les métadonnées en lecture seule
   avec `docs/database/inspect-schema.sql`. Comparer les types exacts, policies,
   triggers, index, ACL, fonctions, propriétaires, dépendances et `search_path`.
2. Lire les corps complets des deux RPC historiques et toutes leurs fonctions
   appelées. Confirmer qu'ils insèrent exactement un document, que le type de retour
   est un objet JSON `{id, document_number}`, que le numéro vient de la base après
   suppression du numéro client, et qu'ils n'effectuent pas d'effets de bord
   supplémentaires. L'émetteur doit utiliser uniquement les droits accordés au rôle
   isolé; une dépendance manquante doit faire échouer l'appel, pas conduire à des
   grants globaux. Revoir aussi les fonctions `SECURITY DEFINER` exposées qui
   appellent les anciens RPC.
3. Confirmer l'index unique partiel réel et les dates/taux/statuts/types existants.
   Résoudre manuellement toute valeur de statut historique hors du contrat observé;
   ne pas normaliser les lignes pour faire passer la migration.
4. Exécuter `tests/database/invoices/run.sh` sur une version PostgreSQL compatible,
   puis appliquer la migration sur une copie isolée fidèle du vrai schéma et des
   corps réels. Les fixtures incluses sont synthétiques et ne prouvent pas que le
   précontrôle ni les hypothèses sur les RPC correspondent à la production.
5. Tester avec deux utilisateurs JWT/RLS (anon, authenticated, `service_role`) les
   sélections et opérations CRUD de documents, les appels v1/v2/v3, propriétaire
   falsifié, accès croisé, statuts, rejeu, payload modifié, plusieurs prix/types de
   lignes, et émissions concurrentes. Vérifier aussi les autres RPC `SECURITY
   DEFINER`, signatures, reçus, politiques de stockage et éventuels rôles SQL
   privilégiés; ce patch ne certifie pas ces autres surfaces.
6. Ne pas mettre à jour ni supprimer les factures existantes. Examiner les résultats
   de précontrôle, tests, audit des dépendances et approbation avant migration; aucun
   accès de production n'a été utilisé pour ce travail.

## Tests PostgreSQL isolés

`tests/database/invoices/run.sh` crée un cluster temporaire local à socket Unix, sans
paramètre de connexion externe et sans Docker; il installe un schéma synthétique et
les migrations dans une transaction. Il teste les montants, clés manquantes, tentative
de propriétaire/numéro/totaux falsifiés, appels legacy, mutation/suppression d'une
facture, statut de paiement séparé, brouillon non numéroté, isolation RLS, répétition
et émission concurrente. Il ne touche pas aux bases Supabase. Pour l'exécution :

```sh
tests/database/invoices/run.sh
```

## Retour arrière et récupération

La migration conserve les lignes et ne réécrit aucun numéro; si une instruction échoue,
la transaction de migration doit être annulée intégralement. Il n'y a volontairement
pas de migration descendante qui enlève le trigger ou réactive v1/v2 : cela détruirait
la garantie d'immuabilité ou restaurerait l'acceptation des montants navigateur.
En cas d'échec fonctionnel après application, corriger par migration avant plutôt que
de réactiver les RPC. Si un arrêt de l'émission est nécessaire, révoquer seulement
l'EXECUTE v3 et laisser actifs les garde-fous. Garder la lecture des documents et les
mises à jour de `invoice_status` seulement après vérification.

Un retour arrière applicatif doit rester en lecture seule pour les émissions, ne pas
réactiver v2, et ne pas restaurer des factures depuis une sauvegarde qui écraserait des
documents émis depuis celle-ci. Les rôles d'administration/propriétaires PostgreSQL
peuvent toujours contourner un trigger; protéger leurs accès, sauvegardes et journaux
selon les contrôles d'exploitation habituels.

## Vérification faite ici et limites

Exécuté en local : `tests/database/invoices/run.sh` (cluster PostgreSQL 16 temporaire,
fixture synthétique, tests de validation, ACL, immuabilité, rejeu et concurrence).
Ces résultats valident la syntaxe et le comportement face à ce contrat synthétique,
pas le schéma réel. Aucun test Supabase, Vercel ou production n'a été possible; aucune
facture, table ou donnée client réelle n'a été modifiée. Les calculs/régimes de TVA
doivent être confirmés par un professionnel; cette préparation n'affirme aucune
conformité juridique ou fiscale française.
