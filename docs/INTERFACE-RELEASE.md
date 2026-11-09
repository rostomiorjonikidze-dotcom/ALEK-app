# Vérification de l’interface publique

Cette liste accompagne les corrections de navigation et d’installation. Elle ne
remplace pas une recette visuelle sur le Preview intégré et ne constitue pas une
validation juridique ou une certification d’accessibilité.

## Routes et contrôles

Sur `/`, `/a-propos`, `/contact`, `/legal`, `/outils-pro`, `/pricing` et
`/welcome` : vérifier au clavier que le premier lien « Aller au contenu principal »
est visible au focus, qu’il amène au contenu, puis vérifier que l’en-tête du site
est un landmark distinct du landmark principal. Vérifier aussi le menu mobile,
l’état de la route active et l’absence de débordement à 320, 390 et 768 px.

## Installation de l’application

La page est publique et ne nécessite ni compte ni données de test. Dans un profil
mobile iOS/iPadOS non installé, ouvrir l’aide d’installation et vérifier les étapes
Safari / Partager / « Sur l’écran d’accueil », la lecture du titre et du descriptif
du dialogue, sa fermeture par Échap et le retour du focus au bouton. Tester aussi
un navigateur compatible avec l’invite native : celle-ci peut intercepter le clic,
et son affichage ou son acceptation dépend du navigateur et de l’éligibilité PWA.
Une simulation de `beforeinstallprompt` ne remplace pas ce contrôle natif.

## Vérifications locales

- `node --experimental-strip-types --test tests/install-platform.test.mjs`
  couvre la détection iPhone/iPad, l’agent utilisateur iPadOS de bureau et les
  plateformes non iOS.
- `tests/public-smoke.test.mjs` vérifie les réponses HTTP ainsi que la présence du
  lien de saut et du landmark principal sur les sept routes ci-dessus. Il nécessite
  un serveur déjà disponible via `ALEK_BASE_URL` (ou `localhost:3000`) ; ne pas
  démarrer un serveur hors du cycle Preview géré pour contourner la recette.

L’éditeur doit valider ces parcours sur le Preview intégré, y compris l’invite
d’installation native lorsqu’un appareil/profil éligible est disponible.
