# Maison des Merlettes : maquette 3D

Maquette 3D interactive de la maison CCMI Castelord (parcelle AE 118, Deuil-la-Barre), en Three.js r169.
Le build produit une page HTML unique et autonome (JavaScript, styles, textures et modèles inclus), qui s'ouvre hors ligne.

Sources de référence : plans travaux v3 (22/09/2026), plan de bornage avec altimétrie, plans du permis, notice et avenant 1,
plus les choix du client. La liste complète des cotes et de leur statut est tenue à part (cotes-maquette.md).

## Commandes

Node 24 (comme sur Netlify) ; Vite demande au moins Node 20.19 ou 22.12.

```sh
npm ci
npm run dev        # serveur de développement Vite, rechargé à chaque modification (http://localhost:5173)
npm run typecheck  # vérification TypeScript sans sortie : sources (tsconfig.json) et vite.config.ts (tsconfig.node.json)
npm run build      # typecheck, puis build Vite : dist/index.html et out/
npm run preview    # sert dist/ en local pour essayer la page construite
npm run smoke      # essai de fumée de dist/index.html dans Chromium sans écran (voir plus bas)
```

## Sorties du build

| Fichier | Contenu |
|---|---|
| `dist/index.html` | page autonome complète, seul fichier publié par Netlify (≈ 875 Ko) |
| `out/maquette.html` | fragment publié comme Artifact claude.ai : la même page sans doctype, `html`, `head` ni `body` |
| `out/maison-merlettes-3d.html` | copie de `dist/index.html` sous le nom de l'ancien build (scripts de rendu existants) |

- `index.html` est le gabarit de la page (ancien `template.html`) : panneau de commandes, styles, et le script `src/main.ts`.
- Vite assemble et minifie les sources ; `vite-plugin-singlefile` inclut le JavaScript dans la page, sans aucun fichier annexe.
  Les textures sont dessinées sur canvas au chargement : il n'y a pas d'image à inclure.
- Le petit plugin de `vite.config.ts` remet le script en fin de `body`, comme dans l'ancien gabarit, puis écrit le fragment :
  tout ce qui suit le repère `<!-- fragment Artifact … -->` du `head` (titre, styles, police), puis le contenu du `body`.
  L'en-tête de page (meta charset et viewport, style de base) reste hors du fragment.
- Le CSS du gabarit est repris tel quel (pas de minification CSS) ; l'avis de licence de three.js est conservé dans le script.

## Essai de fumée

`npm run smoke` ouvre `dist/index.html` (ou la page passée en argument : `npm run smoke -- out/maison-merlettes-3d.html`) dans Chromium
sans écran, rendu logiciel SwiftShader, et attend que la maquette soit prête (`body.ready`). Il échoue sur toute erreur de page,
sur un fichier annexe demandé à côté de la page, ou au bout de 5 minutes (`SMOKE_TIMEOUT` en ms).

Il utilise `playwright-core`, qui ne télécharge aucun navigateur à l'installation : le chemin de Chromium vient de
`CHROMIUM_PATH` (ou `CHROME_PATH`), par défaut `/opt/pw-browsers/chromium`.

## Organisation des sources

```
index.html                gabarit de la page : panneau de commandes, styles
vite.config.ts            build : page unique, fragment Artifact
scripts/smoke.mjs         essai de fumée (npm run smoke)
src/
  main.ts                 point d'entrée : construction de la scène dans l'ordre, boucle d'animation
  types.ts                types partagés : contexte des modules (Ctx), ouvrants, vues, état du panneau
  noyau/                  socle commun
    outils.ts             petits outils numériques (rng, clamp, smooth…)
    textures.ts           textures dessinées sur canvas, finitions de sol au choix
    materiaux.ts          matériaux partagés (M), choix des carrelages et parquets
    geometrie.ts          accumulateur de faces par calque et matériau, fusion des maillages statiques, murs
    etat.ts               calques de la scène, ouvrants, points d'accroche, réglages du panneau
    rendu.ts              moteur WebGL, caméra, orbite, occlusion ambiante, rendu à la demande
    soleil.ts             ciel, soleil selon le mois et l'heure, ambiance, lampes, animation sur 24 h
  maison/                 la maison
    plan.ts               données du plan : niveaux, longueurs, ouvertures
    facades.ts            murs, enduit, modénatures, menuiseries extérieures, garde-corps, portes d'entrée et de garage
    cloisons.ts           planchers, cloisons, portes intérieures, placards, équipements fixes
    escalier.ts           escalier 1/4 tournant
    toiture.ts            toiture 4 pans
    ouvrants.ts           fenêtres, baies, porte d'entrée et porte de garage cliquables
    equip.ts              PAC, nourrice, spots, garde-corps, grilles VH
  interieur/              aménagement intérieur
    mobilier.ts           cuisine, séjour, chambres, radiateurs, garage
    bains.ts              salles de bains, WC, douches, sèche-serviettes
    chambre1.ts           bureau de la chambre parentale, pièce bureau, canapé-lit
    sousEscalier.ts       placard et banquette sous l'escalier
    prises.ts             prises, prises extérieures, robinets
    voiture.ts            Peugeot 5008 III
  terrain/                parcelle et voisinage
    relief.ts             limites, points levés, terrain fini, profil de rue, allée ; hAt(x, z)
    revetements.ts        revêtements drapés sur le terrain
    abords.ts             sol, rue des Fauvettes, allée, terrasse, pergola, jardin de pluie, arbres, haies
    clotures.ts           clôtures, portillon et portail coulissant
    rue.ts                rue des Merlettes : profil, bordures, mobilier
    env.ts                voisins et environnement est et sud
  interface/              ce que l'on voit et manipule
    vues.ts               vues prédéfinies, visibilité des calques
    etiquettes.ts         étiquettes des pièces (vues « maison ouverte »)
    panneau.ts            panneau de commandes, clic sur les ouvrants, capture ; accès d'essai window.__maquette
    nav.ts                vues des pièces, balade au clavier, optiques, collisions ; accès d'essai window.__nav
```

Quelques règles à garder :

- L'ordre de construction de `init()` (`main.ts`) fixe l'ordre de création des matériaux et des objets, donc l'ordre de dessin
  des surfaces confondues : le changer peut modifier le rendu.
- L'état mutable partagé (moteur, scène, caméra, soleil…) appartient à son module (`noyau/rendu.ts`, `noyau/soleil.ts`) :
  les autres modules lisent ses `export let` et passent par ses fonctions pour le modifier (`markShadowDirty`, `setFast`…).
- Les modules historiques (`nav`, `ouvrants`, `env`, `rue`, `equip`, `interieur/*`) reçoivent le contexte `Ctx` créé par `main.ts`.
- TypeScript en mode non strict : `npm run typecheck` doit passer sans erreur. Les types de three.js viennent de `@types/three`.

## Déploiement Netlify

`netlify.toml` est prêt : commande `npm run build`, dossier publié `dist`, Node 24.
Relier le dépôt à Netlify (Add new site → Import an existing project → GitHub) suffit ; chaque push sur `main` publie le site,
chaque branche ou pull request a sa propre préversion, et chaque déploiement garde une URL permanente.

La page est envoyée avec `X-Robots-Tag: noindex, nofollow`, mais l'URL reste publique : pour restreindre l'accès,
activer la protection par mot de passe du site dans Netlify (Site configuration → Access & security).

## Versions

Un commit par version publiée de la maquette, tagué `vNN` (même numéro que la version de l'Artifact, publiée depuis
`out/maquette.html`). Chaque commit se build seul : on peut créer une branche depuis n'importe quel tag (`git switch -c essai v24`).
Jusqu'à la v32, les sources étaient des fichiers `.js` à la racine, assemblés par `build.mjs` (esbuild).

L'historique commence à la v13 : les sources des versions 1 à 12 n'ont pas été conservées. Les versions 14 et 16 à 18
n'ont pas de sauvegarde séparée ; leurs changements sont regroupés dans les commits v15 et v19.

## Repère

Origine à l'angle nord-est extérieur de la maison, X vers le sud (0 → 12,90), Z vers l'ouest (0 → 7,90), Y vers le haut.
RDC fini 0 = NGF 55,70 ; terrain fini autour de la maison 55,53 ; étage +2,87.
