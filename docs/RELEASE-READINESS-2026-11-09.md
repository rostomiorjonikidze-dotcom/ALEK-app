# ALEK — préparation d'une livraison contrôlée

## Décision

**Ne pas déployer ni fusionner automatiquement.** Les corrections applicatives de
la PR n°27 et de cette PR de suivi réduisent des risques identifiés, mais l'absence du schéma réel et des
services configurés empêche de déclarer le produit prêt pour la production.
Aucune base réelle, aucun paiement, abonnement, e-mail ou déploiement n'a été déclenché.
Aucune conformité fiscale, juridique, RGPD ou eIDAS n'est certifiée.

## Couverture de la demande

| Domaine | Réalisé dans cette PR / preuve | Conditions restantes |
| --- | --- | --- |
| Authentification | Validation française, initialisation PKCE, récupération invalide désactivée, message d'inscription non révélateur, modèles de confirmation/récupération français et tests hors ligne. | Confirmation obligatoire, SMTP, livraison, redirections, CAPTCHA, politique serveur et expiration des sessions à tester dans Supabase isolé. Voir [AUTH-RELEASE](AUTH-RELEASE.md). |
| Base, RLS, numéros | Inventaire des tables/RPC réellement appelées, contrôles propriétaire dans les routes privilégiées, requêtes de catalogue en lecture seule et matrice A/B/anonyme. | Aucun schéma ni RLS connu : audit SQL, unicité/atomicité/chronologie, idempotence d'émission et isolation restent bloquants. Voir [DATABASE-RELEASE](DATABASE-RELEASE.md). |
| Factures et brouillons | Factures persistées protégées dans l'interface, brouillons locaux rattachés au compte, conservation des anciens brouillons sans attribution hasardeuse. | Immutabilité à imposer dans la base. Avoirs et archivage fiscal nécessitent le contrat réel, pas des colonnes inventées. Voir [DOCUMENTS-RELEASE](DOCUMENTS-RELEASE.md). |
| Abonnements | Carte intégrée en EUR/mois, prix attendus Pro 19,99 € / Avancé (identifiant Business) 49,99 €, gardes, idempotence fournisseur, conservation des identifiants PayPal. | Verrou transactionnel inter-fournisseurs, périodes et politique PayPal, essais des événements/livraisons fournisseur. Voir [BILLING-RELEASE](BILLING-RELEASE.md). |
| PDF/TVA/signature | Calculs au centime et tests existants conservés, chargement différé PDF, signature atomique conditionnée par statut/expiration/hash, refus des liens révoqués et erreurs contrôlées. | TVA mixte, TVA vendeur/date d'exécution/champs sectoriels et stockage canonique à valider ; vrai export des documents conservés et preuve de signature à vérifier en environnement configuré. |
| Français/mobile/accessibilité | Messages et contrôles complémentaires en français, navigation et aide d'installation améliorées ; aide alternative à la signature manuscrite. | Aucun audit exhaustif WCAG ni test tactile matériel ; validation des parcours connectés et fournisseurs réels. Voir [INTERFACE-RELEASE](INTERFACE-RELEASE.md). |
| Sécurité/API | Corps JSON bornés en octets pendant lecture sur IA, images, partage et signature ; objets/média/UTF-8 invalides refusés. Tests sans appels externes. | Limites de transport et de débit du proxy/hébergeur à configurer ; quota/RPC, accès aux signatures, rétention et journaux à auditer. Ces limites applicatives ne remplacent pas la protection d'entrée. |

## Signature : portée exacte

Les tests de routes utilisent une base simulée, jamais un schéma inventé à déployer.
Ils couvrent le filtre propriétaire, le token haché, les snapshots altérés, révocation,
expiration, consentement explicite et conflit d'acceptation concurrente. La procédure
reste une signature électronique **simple** : ni identité forte, ni horodatage qualifié,
ni garantie de force probante. L'attestation PDF ne remplace pas le devis signé et
la politique de conservation des originaux doit être validée par l'exploitant.
Le lien public expire à sa date initiale même après signature : télécharger
l’attestation avant cette échéance. Cette expiration ne supprime pas la preuve stockée.

## Vérification intégrée

Résultats intégrés du 9 novembre 2026 sur la branche de suivi :
- `npm test` : **73 tests réussis**, aucun échec ni test ignoré.
- `npm run lint`, `npm run typecheck`, `npm run build` et `git diff --check` : réussis.
- `node --test tests/public-smoke.test.mjs` contre le Preview géré : **32 tests réussis**.
- Navigateur à 390 px : connexion française, prix 19,99 € / 49,99 €,
  tableau de bord et signature synthétique. Aucun débordement constaté sur tarifs,
  tableau de bord et signature ; aucune exception navigateur dans ces contrôles.
- Avec session et lignes Supabase interceptées : ouverture d’une facture, totalité
  du fieldset désactivée, export PDF téléchargé avec F-TEST-001, description stockée
  et montants HT 100 € / TTC 120 €. Le test unitaire couvre aussi les données
  persistées invalides et les écarts de totaux ; ces variantes ne sont pas toutes
  rejouées manuellement.
- Signature interceptée : bouton initialement désactivé, nom/tracé/consentement,
  réponse simulée acceptée puis téléchargement de l’attestation. La logique serveur
  est couverte séparément par les tests de routes avec base simulée.
- Après les erreurs de chunks observées pendant des compilations concurrentes,
  arrêt du Preview, reconstruction terminée puis redémarrage géré : les pages
  ci-dessus chargent correctement. Ne pas reconstruire `.next` pendant son service.

Les fixtures et captures restent hors Git ; la configuration locale ignorée ne
contient que des valeurs de démonstration. Les tests simulés ne valent ni validation
Supabase ni validation des moyens de paiement. La recette complète multi-compte,
les mutations réelles, l’installation native et l’audit d’accessibilité restent à faire.

## Ordre des opérations avant livraison (à faire, pas exécuté)

1. Fournir le schéma réel expurgé, le reconstruire sans données clients et exécuter
   la matrice d'isolation/immutabilité/numérotation. Corriger les garanties manquantes
   dans des migrations révisées ; ne rien appliquer en production sans approbation.
2. Définir avec l'exploitant les règles d'avoir, d'archive et de fin de période PayPal ;
   résoudre les limites de persistance documentées, y compris le verrou d'abonnement.
3. Configurer uniquement les services **de test**, relire les modèles français et
   vérifier inscription → confirmation → connexion → récupération → déconnexion.
4. Après autorisation explicite pour les opérations fournisseur de test, vérifier
   carte intégrée/PayPal existant, prix, activation, renouvellement, échec, annulation,
   rejeu et ordre des webhooks, avec zéro charge réelle.
5. Vérifier les PDF courts/longs et signés, mentions de l'exploitant, TVA applicable,
   obligations sectorielles et facturation électronique avec les responsables compétents.
6. Archiver les preuves expurgées, approuver la PR et préparer sauvegarde/retour arrière.
   Toute fusion ou livraison est une décision ultérieure explicite de l'exploitant.
