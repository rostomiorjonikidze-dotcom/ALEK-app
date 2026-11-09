# Préparation de l’authentification Supabase

Ce document accompagne l’interface des routes `/login` et `/reset-password`. Il ne signifie pas que le projet Supabase hébergé a été configuré ou testé. Aucun secret, paramètre distant, e-mail ou compte n’a été modifié pendant cette tâche.

## Configuration à faire par l’exploitant

Effectuer d’abord ces étapes dans un projet Supabase de test isolé. Les changements au projet de production nécessitent l’autorisation et la procédure de changement de l’exploitant.

1. **URL Auth** — Dans *Authentication → URL Configuration*, définir le Site URL de production à `https://app.alek.best` et autoriser exactement `https://app.alek.best/login` et `https://app.alek.best/reset-password`. Ajouter les deux chemins `http://localhost:3000/login` et `http://localhost:3000/reset-password` uniquement au projet de développement concerné. Ne pas utiliser de joker large. Les URL transmises par l’application sont construites depuis l’origine courante : inscription vers `/login`, récupération vers `/reset-password`.
2. **Confirmation d’adresse** — Activer l’inscription par e-mail et exiger la confirmation de l’adresse avant la première connexion. Ce réglage est nécessaire pour le parcours d’inscription avec vérification ; les valeurs par défaut diffèrent entre les projets hébergés et auto-hébergés.
3. **Politique du mot de passe** — La validation de l’interface exige au moins 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial, à l’inscription comme à la réinitialisation. Régler également la politique Auth côté serveur au minimum à 10 caractères et aux exigences de complexité disponibles. Vérifier avec des tentatives dans le projet de test que Supabase rejette également un mot de passe faible : la validation du navigateur n’est pas une protection serveur. Si le projet ne permet pas d’appliquer toutes les règles souhaitées, définir et valider une solution serveur avant la mise en production plutôt que de considérer la règle client suffisante.
4. **SMTP et expéditeur** — Configurer un fournisseur SMTP personnalisé pour la livraison réelle. Renseigner dans le tableau de bord Supabase l’hôte, le port, l’utilisateur, le secret SMTP et une adresse expéditeur autorisée sur un domaine contrôlé par l’exploitant. Publier et vérifier les enregistrements SPF, DKIM et DMARC suivant les instructions du fournisseur, puis tester réception, rebonds, spam, limites et réputation. Ne pas placer de secret SMTP dans le dépôt ou dans une variable `NEXT_PUBLIC_*`. Le SMTP intégré Supabase est destiné au développement : la documentation indique actuellement une limite de 2 e-mails/heure et une restriction aux adresses préautorisées de l’organisation ; ces limites peuvent évoluer.
5. **Modèles français** — Dans *Authentication → Email Templates*, copier le contenu de `supabase/templates/confirmation.html` dans le modèle de confirmation et celui de `supabase/templates/recovery.html` dans le modèle de récupération. Définir les objets « Confirmez votre adresse e-mail — ALEK » et « Réinitialisez votre mot de passe — ALEK ». Les fichiers emploient uniquement `{{ .ConfirmationURL }}`, variable documentée pour ces liens. Vérifier le rendu réel reçu avec le fournisseur choisi. Aucun `supabase/config.toml` ni configuration de projet n’est ajouté ici ; si l’équipe souhaite gérer les modèles localement, elle devra relier ces fichiers aux chemins `content_path` du fichier de configuration approuvé.
6. **CAPTCHA** — Si la protection anti-robot est activée, définir `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` au build de l’application avec la clé publique hCaptcha correspondante, puis activer hCaptcha dans les paramètres *Authentication → Bot and Abuse Protection* du projet et y configurer la clé secrète. La page transmet le jeton pour connexion, inscription et récupération. Ne pas activer le CAPTCHA côté serveur sans fournir le sitekey public correspondant, ni considérer la seule présence du widget comme une protection. La configuration actuelle est facultative tant que le sitekey n’est pas défini.
7. **Limites et sessions** — Vérifier les limites de débit Auth adaptées au trafic attendu, les options de notification de sécurité et la révocation des sessions après changement de mot de passe. Ne pas relever les limites sans besoin justifié.

Les seules variables client Auth utilisées par l’application sont `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et, si hCaptcha est activé, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`. Les deux premières sont des identifiants publics de client, pas des clés de service. Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` dans le navigateur.

## Parcours de recette hors production

Employer une boîte de test contrôlée et des identifiants fictifs dans un projet isolé ; ne pas lancer la recette contre les clients ou les paramètres de production.

- Créer un compte avec un e-mail valide, vérifier l’affichage du message en français, recevoir le modèle, ouvrir le lien dans le même navigateur/profil ayant lancé la demande et vérifier le retour sur `/login` puis l’accès après confirmation.
- Avant confirmation, vérifier que la connexion est refusée. Après confirmation, vérifier la connexion, puis déconnexion et reconnexion.
- Vérifier les erreurs de connexion sans exposer les diagnostics Supabase. Vérifier que l’erreur d’adresse déjà enregistrée n’affiche pas directement que l’adresse existe.
- Demander une récupération pour une adresse de test, vérifier le modèle français, ouvrir le lien dans le navigateur/profil d’origine, rejeter les mots de passe faibles ou différents, enregistrer un mot de passe valide et se connecter avec lui. Vérifier aussi un lien expiré/réutilisé et demander un nouveau lien.
- Tester hCaptcha activé et les erreurs/expiration du jeton. Contrôler les journaux Auth et la limitation des envois ; aucun test ne doit envoyer de message à une adresse réelle non autorisée.
- Tester au moins un client mobile et un navigateur de bureau avec clavier et lecteur d’écran. Confirmer l’absence de secrets ou de jetons dans les journaux applicatifs.

Les tests locaux `npm test` simulent les appels et ne contactent ni Supabase, ni SMTP, ni hCaptcha. Ils ne valident pas la livraison d’e-mail, la liste d’autorisation distante, les paramètres de mot de passe du projet, la configuration CAPTCHA ou le comportement réel du navigateur après échange PKCE.

## Références Supabase

- [Modèles d’e-mail et variables disponibles](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Personnalisation des modèles en local et `content_path`](https://supabase.com/docs/guides/local-development/customizing-email-templates)
- [Configuration SMTP personnalisée et limites du service intégré](https://supabase.com/docs/guides/auth/auth-smtp)
- [URL de redirection, Site URL et liste autorisée](https://supabase.com/docs/guides/auth/redirect-urls)
- [Authentification par mot de passe et confirmation d’e-mail](https://supabase.com/docs/guides/auth/passwords)
- [Limites de débit Auth](https://supabase.com/docs/guides/auth/rate-limits)
- [Protection CAPTCHA Auth](https://supabase.com/docs/guides/auth/captcha)
