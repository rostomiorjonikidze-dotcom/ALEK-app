# Mise en production — authentification ALEK

Ce guide décrit les réglages à vérifier, sans prétendre que le projet Supabase, Vercel ou le DNS de production a été inspecté ou modifié. Les essais doivent d’abord se faire dans un projet Supabase isolé, avec une boîte de test contrôlée. Aucun e-mail ne doit être envoyé à un client pendant la recette.

## URLs et flux de confirmation

Dans **Supabase → Authentication → URL Configuration** :

- Définir la **Site URL** de production à `https://app.alek.best`.
- Autoriser ces URL de redirection exactes, sans joker :
  - `https://app.alek.best/login` — confirmation d’inscription.
  - `https://app.alek.best/reset-password` — lien de mot de passe oublié.
- Dans le projet de développement uniquement, autoriser les deux URLs correspondantes :
  - `http://localhost:3000/login`
  - `http://localhost:3000/reset-password`
- Ne pas ajouter `localhost`, un domaine de prévisualisation ou un joker large au projet de production. Ajouter une URL Preview uniquement si elle est stable, contrôlée et nécessaire, puis la retirer quand elle ne l’est plus.
- Activer la confirmation par e-mail et vérifier dans un projet isolé qu’un compte non confirmé ne peut pas ouvrir de session.

Le code construit les redirections depuis l’origine courante et ne lit pas une URL de redirection arbitraire fournie par l’utilisateur. Le client navigateur désactive son initialisation automatique, installe d’abord un observateur Auth partagé, puis initialise Supabase ; cet ordre conserve le signal `PASSWORD_RECOVERY` même si l’initialisation PKCE finit avant le montage React. Le SDK ne rejoue pas cet événement aux abonnés tardifs (`INITIAL_SESSION` ne prouve qu’une session présente). La page exige donc le signal émis par le SDK après récupération et une session active du même utilisateur ; un paramètre URL comme `type=recovery` ou une session ordinaire ne suffit pas. L’observateur est partagé et idempotent pour supporter les effets React StrictMode. La récupération refuse aussi les réponses callback contenant `error`, `error_code` ou `error_description`. Ouvrir les liens dans le même profil de navigateur que celui ayant demandé l’e-mail.

## Variables et CAPTCHA

Configurer dans l’environnement de build/de déploiement Vercel les valeurs publiques requises par l’application, en utilisant les valeurs du projet Supabase choisi :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` seulement lorsque CAPTCHA est activé.

Ne pas mettre de secret SMTP, de clé secrète hCaptcha ou de `SUPABASE_SERVICE_ROLE_KEY` dans une variable `NEXT_PUBLIC_*`, le code client ou le dépôt. Les noms et valeurs présents dans Vercel n’ont pas été vérifiés dans cette tâche.

Le CAPTCHA est facultatif côté interface tant que `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` n’est pas défini. Pour l’activer, définir le sitekey public dans chaque environnement de build concerné, puis activer hCaptcha et saisir sa clé secrète dans **Supabase → Authentication → Bot and Abuse Protection**. Vérifier les trois flux (inscription, connexion, récupération) avec un jeton valide, manquant, expiré et rejeté. Si l’application n’est pas prête, laisser le CAPTCHA Supabase désactivé plutôt que de bloquer les utilisateurs avec une configuration incomplète.

Dans **Authentication → Rate Limits**, conserver des limites adaptées et vérifier les limites d’envoi d’e-mail et d’authentification avec le trafic prévu. Ne pas augmenter les limites pour contourner un refus CAPTCHA ou des erreurs d’envoi. Confirmer que les messages d’échec restent génériques et français.

## SMTP et DNS (SPF, DKIM, DMARC)

1. Choisir et valider un fournisseur d’e-mail transactionnel autorisé, puis configurer **Supabase → Authentication → SMTP Settings** avec l’hôte, le port, l’identifiant, le secret SMTP et l’expéditeur exacts que ce fournisseur indique. Garder le secret uniquement dans le tableau de bord sécurisé Supabase. Le SMTP intégré Supabase ne doit pas être considéré comme un service d’envoi de production.
2. Utiliser un domaine d’expéditeur contrôlé par l’exploitant. Depuis le tableau de bord du fournisseur, récupérer les enregistrements DNS exacts nécessaires pour ce domaine. Publier le SPF et tous les sélecteurs DKIM exactement comme fournis ; ne pas inventer de valeur ni publier plusieurs enregistrements SPF distincts sur le même nom. Si un SPF existe, fusionner les autorisations avec le propriétaire du domaine plutôt que l’écraser.
3. Publier `_dmarc.<domaine-expéditeur>` avec une politique de surveillance initiale recommandée par l’exploitant, une adresse de rapports contrôlée si les rapports sont souhaités, puis examiner les rapports et l’alignement SPF/DKIM avant de renforcer progressivement la politique (`quarantine`, puis éventuellement `reject`). Ne pas déployer un rejet avant d’avoir vérifié tous les expéditeurs légitimes du domaine.
4. Vérifier les TXT publiés dans le DNS autoritatif et la résolution publique avec le fournisseur (par exemple `dig TXT <nom>`). Le nom d’hôte, les sélecteurs DKIM, le contenu SPF et la politique DMARC sont propres au fournisseur et au domaine : ils ne sont pas connus ici et ne doivent pas être copiés depuis un exemple.
5. Dans un projet de test, envoyer uniquement vers des boîtes contrôlées. Vérifier confirmation, récupération, rendu mobile, expéditeur, réception, rebonds, spam, limites, journaux et alignement DMARC avant approbation de production.

## Modèles français

Copier [`supabase/templates/confirmation.html`](../supabase/templates/confirmation.html) dans le modèle de confirmation d’adresse et [`supabase/templates/recovery.html`](../supabase/templates/recovery.html) dans le modèle de récupération de mot de passe du projet Supabase. Les deux fichiers utilisent `{{ .ConfirmationURL }}` pour le bouton et son lien de secours. Définir un objet français adapté et vérifier le rendu réel du message reçu. Toute personnalisation supplémentaire doit conserver la variable de lien attendue par le modèle Supabase.

## Recette isolée avant autorisation de production

- Inscrire un utilisateur fictif : vérifier les champs obligatoires, SIRET/SIREN, force du mot de passe, envoi du CAPTCHA lorsqu’il est activé, message d’attente français et absence de session avant confirmation.
- Confirmer l’adresse depuis le même navigateur : vérifier le retour sur `/login`, l’échange PKCE, puis une connexion normale. Vérifier aussi l’échec avant confirmation et la gestion d’un lien expiré ou déjà utilisé.
- Tester une connexion valide, un mot de passe incorrect, une adresse non confirmée, une limitation de débit et une erreur CAPTCHA. Aucune réponse ne doit révéler de diagnostic interne ou confirmer l’existence d’un compte.
- Demander un lien de récupération, confirmer le message générique, ouvrir le lien dans le même navigateur, vérifier l’initialisation de session avant affichage du formulaire, rejeter un lien échoué/expiré, un mot de passe faible et une confirmation différente, puis enregistrer un mot de passe fort et se reconnecter.
- Vérifier la fermeture de session sur l’interface protégée, puis la reconnexion. Tester les erreurs réseau/provider dans les appels de connexion, récupération, changement de mot de passe et déconnexion.
- Vérifier les notifications de sécurité et la révocation ou le renouvellement des sessions après modification du mot de passe selon le réglage choisi dans Supabase.
- Faire une passe mobile et bureau, clavier et lecteur d’écran, sur `/login` (connexion, inscription, récupération) et `/reset-password` (lien valide, lien invalide, enregistrement réussi). Contrôler qu’aucun mot de passe, jeton ou secret ne se retrouve dans les journaux.

Les tests locaux utilisent des doubles isolés de l’API Supabase et ne contactent ni Supabase, ni Vercel, ni SMTP, ni hCaptcha. Ils ne prouvent pas la configuration distante, la livraison réelle des e-mails, la délivrabilité DNS, la révocation des sessions ou le comportement réel d’un navigateur/provider.
