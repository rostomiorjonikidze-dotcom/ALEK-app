# ALEK — protections de production, suite de la PR #28

## Périmètre et décision

Cette branche conserve les PR #27 et #28. **Aucune migration n’est appliquée à
Supabase, aucun paiement ni e-mail réel n’est lancé, aucune fusion ou mise en
production n’est autorisée par ce travail.** Les migrations sont des candidats
versionnés à réviser et répéter sur une copie isolée du schéma réel, pas une preuve
qu’elles sont compatibles avec chaque objet aujourd’hui installé en production.

Le propriétaire a confirmé : RLS actif sur les tables métier, lectures isolées pour
deux comptes et aucun document/profil privé lisible anonymement ; droits CRUD sur
les propres documents sans immutabilité des factures ; index unique partiel
`(user_id, document_type, document_number)` ; émission `SECURITY DEFINER` via
`issue_artisan_document(jsonb)` et son enveloppe v2, avec totaux reçus du client ;
RPC de quota non exécutables par les utilisateurs ordinaires. Cette vérification
externe n’a pas été répétée contre la production depuis Hoplite. Les corps SQL,
contraintes, triggers, ACL héritées et politiques complets ne sont toujours pas
fournis. Les scripts de catalogue ne lisent pas les lignes clients.

## Garanties et frontières

- L’émission cliente conserve une demande par compte avant l’appel réseau et
  utilise exclusivement la nouvelle RPC v3 : elle ne retombe jamais sur l’ancienne
  émission non protégée. Une réponse perdue conserve la même clé et le même payload.
  Une reprise explicite n’utilise pas les champs modifiés entre-temps. Le verrou
  navigateur coordonne les onglets ; la base reste l’autorité pour la concurrence.
- Ne pas vider le stockage du navigateur pour « débloquer » une émission ambiguë.
  Vérifier/reprendre la demande et conserver son identifiant. Une clé explicitement
  nouvelle désigne une nouvelle opération, pas une déduplication sémantique magique
  de deux documents intentionnellement identiques. Les snapshots locaux ne sont
  pas chiffrés ; un profil navigateur partagé peut les lire.
- Le suivi manuel du paiement n’est pas une preuve bancaire. Il ne change que le
  statut de règlement, jamais les lignes fiscales, le numéro ou les montants.
- Les factures existantes restent intactes. Ne pas transformer un ancien document
  en brouillon pour contourner l’immutabilité. Avoir et archive ne signifient jamais
  suppression de la facture d’origine. Les limites des parcours proposés sont
  précisées dans le guide de migration factures.
- Le modèle applicatif a un taux de TVA global. Ne pas annoncer la TVA mixte tant
  que stockage, calcul, PDF et mentions par taux ne sont pas validés ensemble.
  Le PDF d’une facture persistée conserve ses totaux ; une incohérence historique
  doit être signalée et corrigée par une pièce de correction, pas réécrite en place.
- Un superutilisateur, propriétaire de table ou administrateur capable de désactiver
  les triggers reste une autorité de confiance. Aucun trigger ne rend impossible
  une action volontaire de cet administrateur. Les rôles clients ne doivent jamais
  disposer de ces capacités, d’une clé de service ou d’une RPC SQL arbitraire.

## Dossier par domaine

- [Factures, calculs serveur, émission et reprise](INVOICE-DATABASE-SAFETY.md)
- [Coordination des abonnements et recette fournisseurs](BILLING-RELEASE.md)
- [Permissions, profils et tests d’isolation](SECURITY-PRODUCTION-SAFETY.md)
- [Authentification, SMTP et DNS](AUTH-PRODUCTION-SAFETY.md)

## Ordre de préparation d’une future livraison

1. **Revue préalable** : exporter le schéma sans données clients avec le script
   `docs/database/inspect-schema.sql`, relire et expurger les définitions avant
   partage. Inventorier chaque fonction `SECURITY DEFINER`, ses dépendances, son
   propriétaire, son `search_path` et les ACL, y compris les surcharges. Aucun SQL
   arbitraire exécutable par un rôle client ne doit subsister.
2. **Sauvegarde et restauration** : vérifier une sauvegarde et répéter sa restauration
   dans un environnement isolé. Archiver les définitions des RPC, triggers, politiques
   et index existants. Ne jamais tester un rollback destructif sur la production.
3. **Compatibilité des migrations** : appliquer les fichiers SQL dans leur ordre
   numérique uniquement sur cette copie isolée, avec arrêt à la première erreur.
   Les préconditions sont des gardes, pas des instructions pour supprimer un objet
   gênant. Ajuster/revoir le candidat si le schéma réel diffère ; ne pas forcer.
4. **Tests base** : exécuter les tests locaux jetables, puis adapter/rejouer la matrice
   avec le vrai schéma isolé et deux utilisateurs fictifs, anon et service. Tester
   REST, RPC et SQL sous les rôles clients, les courses et reprises réseau, les
   droits hérités et les tentatives de changer propriétaire/type/numéro.
5. **Configuration de test** : configurer Auth/SMTP/CAPTCHA et les variables Stripe
   et PayPal de test. Le propriétaire indique que Stripe manque dans l’inventaire
   Vercel de production ; aucun secret n’est demandé dans la PR. Les variables
   publiques doivent exister à la compilation ; les secrets restent côté serveur.
6. **Recette fournisseurs isolée** : après autorisation, tester paiements, renouvellement,
   refus, annulation, remboursement, replays et ordre des événements. Vérifier le
   maintien des abonnements PayPal existants et les périodes payées. Aucun montant
   réel ne doit être débité pendant cette recette.
7. **Recette métier** : relire PDF courts/longs, mentions, TVA, correction/avoir,
   conservation, identité de l’exploitant et échéances de facturation électronique
   avec les responsables comptables/juridiques. Tester inscription → confirmation →
   connexion → récupération → nouveau mot de passe → déconnexion sur boîtes de test.
8. **Autorisation distincte de production** : approuver les preuves, le plan de retour
   arrière et une fenêtre sans écritures concurrentes lors du basculement. Installer
   d’abord les protections DB, puis la version applicative compatible ; le client
   échoue volontairement si la nouvelle RPC manque. Ne pas rétablir un ancien code
   d’émission/checkout non protégé comme solution de repli. Préférer désactivation
   ciblée des nouvelles émissions/paiements et correction en avant, en conservant
   les factures, avoirs, identifiants et registres d’idempotence.
9. **Après livraison autorisée uniquement** : surveiller les erreurs et files de
   réconciliation sans journaliser de secrets ; vérifier les droits effectifs et
   les périodes d’accès. Une CI verte sur un fixture ne remplace pas ces contrôles.

## Vérification de cette branche

Les résultats intégrés et les limites de la recette sont consignés à la fin de
l’implémentation. Les tests PostgreSQL emploient un contrat synthétique minimal et
un cluster jetable local ; ils ne représentent pas un export de la production.
