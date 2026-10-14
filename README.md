# Maison des Merlettes : maquette 3D

Maquette 3D interactive de la maison CCMI Castelord (parcelle AE 118, Deuil-la-Barre), en Three.js r169.
Le build produit une page HTML unique et autonome (JavaScript, textures et modèles inclus), qui s'ouvre hors ligne.

Sources de référence : plans travaux v3 (22/09/2026), plan de bornage avec altimétrie, plans du permis, notice et avenant 1,
plus les choix du client. La liste complète des cotes et de leur statut est tenue à part (cotes-maquette.md).

## Build

```sh
npm ci
npm run build        # out/ puis dist/index.html
```

- `build.mjs` assemble `main.js` et ses modules avec esbuild, puis les injecte dans `template.html` :
  - `out/maquette.html` : fragment publié comme Artifact claude.ai ;
  - `out/maison-merlettes-3d.html` : page autonome complète.
- `scripts/dist.mjs` copie la page autonome en `dist/index.html`, le dossier publié par Netlify.

## Déploiement Netlify

`netlify.toml` est prêt : commande `npm run build`, dossier publié `dist`, Node 24.
Relier le dépôt à Netlify (Add new site → Import an existing project → GitHub) suffit ; chaque push sur `main` publie le site,
chaque branche ou pull request a sa propre préversion, et chaque déploiement garde une URL permanente.

La page est envoyée avec `X-Robots-Tag: noindex, nofollow`, mais l'URL reste publique : pour restreindre l'accès,
activer la protection par mot de passe du site dans Netlify (Site configuration → Access & security).

## Versions

Un commit par version publiée de la maquette, tagué `vNN` (même numéro que la version de l'Artifact).
Chaque commit se build seul : on peut créer une branche depuis n'importe quel tag (`git switch -c essai v24`).

L'historique commence à la v13 : les sources des versions 1 à 12 n'ont pas été conservées. Les versions 14 et 16 à 18
n'ont pas de sauvegarde séparée ; leurs changements sont regroupés dans les commits v15 et v19.

## Repère

Origine à l'angle nord-est extérieur de la maison, X vers le sud (0 → 12,90), Z vers l'ouest (0 → 7,90), Y vers le haut.
RDC fini 0 = NGF 55,70 ; terrain fini autour de la maison 55,53 ; étage +2,87.

## Modules

| Fichier | Contenu |
|---|---|
| `main.js` | scène, matériaux, maison, terrain, clôtures, portail, vues, rendu |
| `template.html` | page, panneau de commandes, styles |
| `nav.js` | visites au clavier (hauteur d'homme, libre), collisions |
| `ouvrants.js` | fenêtres, baies, portes et portail cliquables |
| `env.js` | voisins et environnement est et sud |
| `rue.js` | rue des Merlettes : profil, bordures, mobilier |
| `equip.js` | PAC, nourrice, spots, garde-corps, grilles VH |
| `bains.js` | salles de bains, WC, douches, sèche-serviettes |
| `mobilier.js` | cuisine, séjour, chambres, radiateurs, garage |
| `chambre1.js` | bureau de la chambre parentale, pièce bureau, canapé-lit |
| `sousEscalier.js` | placard et banquette sous l'escalier |
| `voiture.js` | Peugeot 5008 III |
| `prises.js` | prises, prises extérieures, robinets |
