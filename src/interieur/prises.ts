// Prises de courant, prises RJ45, prises étanches extérieures et robinets de puisage (demande client du 12/10/2026 :
// « représente les prises de courant, les robinets et prises extérieures »). Appelé avant A.build(groups), après les meubles.
//
// Sources : plans travaux v3 (22/09/2026) p. 12 (RDC électrique) et p. 13 (étage électrique), symboles relevés en vectoriel
// (centre du cercle du symbole, échelle 1/50 = 56,693 pt/m, origine à l'angle nord-est extérieur) ; p. 9 pour les robinets.
// Le centre d'un symbole est dessiné à 7 cm du nu du mur (rayon du symbole) : la prise est posée sur le nu réel de la maquette.
// Deux symboles accolés au pas de 15 cm = une plaque commune (l'avenant 1 parle bien de « prise double » pour les salles d'eau).
// Notice signée (15/12/2025) : appareillage LEGRAND Dooxie blanc dans la partie habitable, Plexo étanche dans les annexes ;
// « X2 robinets de puisage » et « X2 prises étanches extérieures » (p. 11). Avenant 1 (07/07/2026) : 3 prises RJ45 IP pour caméra
// extérieure, 3 prises 16 A supplémentaires (chambres 1, 2, 3), prises doubles en salle de bains et salle d'eau.
// Hauteurs : celles des plans quand elles sont cotées (H:1.10m, H:1.20m, H:1.50m) ; sinon usage NF C 15-100, INFÉRÉES (voir prises.md).
//
// Géométrie légère : tout est fusionné par calque et par matériau (16 maillages, ≈ 10 000 triangles), sans ombre portée, ignoré par les collisions.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Ctx, Vec3 } from '../types';

const E1 = 2.87, T = 0.36, L = 12.90, D = 7.90, SK = 0.008; // repères de main.js ; SK : peau d'enduit en saillie du nu (main.js)
const CRED = 4.24 + 0.006; // crédence de 6 mm sur la cloison cuisine / escalier, de 0,90 à 1,45 (mobilier.js)
const TERR = -0.04; // dessus de la terrasse ouest (main.js, x 2,45 → 10,45)

// n : normale du mur côté pièce ('+x' : mur dont la face regarde le sud…) ; face : coordonnée du nu ; postes : [type, abscisse du symbole
// le long du mur] (p : 2P+T 16/20 A, p32 : 32 A + T, rj : RJ45, x : Plexo étanche, rob : robinet) ; h : hauteur de l'axe au-dessus du sol fini
// (sol : 0, garage −0,13, étage 2,87, 'ext' : terrain fini au pied de la façade, 'terr' : terrasse) ; st : plan (cote lue) ou inf (inférée) ;
// planA : abscisse du symbole au plan quand la prise a été recalée pour ne pas être cachée par un meuble posé après le plan
// (prises de chevet sur les chevets de mobilier.js, à 15 cm du lit ; bureau : bout du canapé-lit de chambre1.js)
/** Appareil du plan électrique (voir le commentaire ci-dessus) */
export interface Prise {
  id: string;
  piece: string;
  lv: string;
  n: string;
  face: number;
  postes: [string, number][];
  h: number;
  st: string;
  type: string;
  mur: string;
  src: string;
  floor?: number | string;
  planA?: number;
}
export const PRISES: Prise[] = [
  // ---- RDC, cuisine (p. 12)
  { id: 'K1', piece: 'Cuisine', lv: 'rdc', n: '+z', face: CRED, postes: [['p', 0.660], ['p', 0.811]], h: 1.10, st: 'plan', type: 'prise double 16 A, plan de travail', mur: 'cloison escalier (z 4,24), sur la crédence', src: 'p. 12, 2 symboles 2P+T « H:1.10m »' },
  { id: 'K2', piece: 'Cuisine', lv: 'rdc', n: '+z', face: 4.24, postes: [['p32', 1.560]], h: 0.30, st: 'inf', type: 'prise 32 A + T (plaque de cuisson)', mur: 'cloison escalier (z 4,24), derrière le meuble bas sous la plaque', src: 'p. 12, symbole 2P+T encadré « 32 A+T »' },
  { id: 'K3', piece: 'Cuisine', lv: 'rdc', n: '+z', face: 4.24, postes: [['p', 1.761]], h: 0.30, st: 'inf', type: 'prise 16 A (usage non indiqué)', mur: 'cloison escalier (z 4,24), derrière le meuble bas', src: 'p. 12, symbole 2P+T sans mention' },
  { id: 'K4', piece: 'Cuisine', lv: 'rdc', n: '+z', face: CRED, postes: [['p', 2.360], ['p', 2.510]], h: 1.10, st: 'plan', type: 'prise double 16 A, plan de travail', mur: 'cloison escalier (z 4,24), sur la crédence', src: 'p. 12, 2 symboles 2P+T « H:1.10m »' },
  { id: 'K5', piece: 'Cuisine', lv: 'rdc', n: '+z', face: 4.24, postes: [['p', 3.441]], h: 0.30, st: 'inf', type: 'prise spécialisée 20 A (four, d\'après la colonne)', mur: 'cloison escalier (z 4,24), derrière la colonne four', src: 'p. 12, symbole 2P+T « 20 A »' },
  { id: 'K6', piece: 'Cuisine', lv: 'rdc', n: '+z', face: 4.24, postes: [['p', 3.590]], h: 1.50, st: 'plan', type: 'prise 16 A à 1,50 m (micro-ondes, d\'après la colonne)', mur: 'cloison escalier (z 4,24), derrière la colonne four', src: 'p. 12, symbole 2P+T « H:1.50m »' },
  { id: 'K7', piece: 'Cuisine', lv: 'rdc', n: '-z', face: D - T, postes: [['p', 3.611], ['p', 3.761]], h: 1.10, st: 'plan', type: 'prise double 16 A, plan de travail (péninsule)', mur: 'façade ouest (nu z 7,54)', src: 'p. 12, 2 symboles 2P+T « H:1.10m »' },
  { id: 'K8', piece: 'Cuisine', lv: 'rdc', n: '+x', face: T, postes: [['p', 6.140]], h: 0.30, st: 'inf', type: 'prise spécialisée 20 A lave-vaisselle', mur: 'façade nord (nu x 0,36), sous l\'évier', src: 'p. 12, symbole 2P+T « LV 20 A »' },
  { id: 'K9', piece: 'Cuisine', lv: 'rdc', n: '+x', face: T, postes: [['p', 7.040]], h: 0.30, st: 'inf', type: 'prise 16 A (usage non indiqué)', mur: 'façade nord (nu x 0,36), derrière le meuble bas d\'angle', src: 'p. 12, symbole 2P+T sans mention' },
  // ---- RDC, entrée, local technique, garage
  { id: 'E1', piece: 'Entrée', lv: 'rdc', n: '-x', face: 5.16, postes: [['p', 2.849]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'cloison entrée / garage (nu x 5,16)', src: 'p. 12, symbole 2P+T' },
  { id: 'G1', piece: 'Local technique', lv: 'rdc', n: '-z', face: 3.15, postes: [['x', 5.910]], h: 0.30, floor: -0.13, st: 'inf', type: 'prise 16 A Plexo étanche (saillie)', mur: 'mur garage / séjour (nu z 3,15)', src: 'p. 12, symbole 2P+T ; notice : Plexo en annexe' },
  { id: 'G2', piece: 'Local technique', lv: 'rdc', n: '+z', face: T, postes: [['x', 6.710]], h: 0.60, floor: -0.13, st: 'inf', type: 'prise spécialisée 20 A lave-linge, Plexo étanche', mur: 'doublage du mur est (nu z 0,36, plan p. 9 : x 5,31 → 7,01), derrière le lave-linge', src: 'p. 12, symbole 2P+T « Mach.à lav. 20 A »' },
  // ---- RDC, salle à manger et séjour
  { id: 'S1', piece: 'Salle à manger', lv: 'rdc', n: '+z', face: 3.30, postes: [['p', 6.810]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'mur garage / séjour (nu z 3,30)', src: 'p. 12, symbole 2P+T' },
  { id: 'S2', piece: 'Séjour', lv: 'rdc', n: '+z', face: 3.30, postes: [['rj', 10.740], ['rj', 10.890], ['p', 11.041], ['p', 11.191], ['p', 11.341]], h: 0.30, st: 'inf', type: '2 RJ45 + prise triple 16 A (plaque 5 postes)', mur: 'mur garage / séjour (nu z 3,30), derrière le meuble TV', src: 'p. 12, 2 symboles RJ45 « RJ45 » + 3 symboles 2P+T accolés' },
  { id: 'S3', piece: 'Salle à manger', lv: 'rdc', n: '-z', face: D - T, postes: [['p', 7.741]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'façade ouest (nu z 7,54), au nord de la baie', src: 'p. 12, symbole 2P+T' },
  { id: 'S4', piece: 'Séjour', lv: 'rdc', n: '-x', face: L - T, postes: [['p', 6.439]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'façade sud (nu x 12,54), à l\'ouest de la baie', src: 'p. 12, symbole 2P+T' },
  // ---- extérieur RDC
  { id: 'X1', piece: 'Extérieur ouest (terrasse)', lv: 'rdc', n: '+z', face: D + SK, postes: [['x', 5.160]], h: 0.40, floor: 'terr', st: 'inf', type: 'prise étanche extérieure Plexo à clapet', mur: 'façade ouest, au nord de la baie du séjour', src: 'p. 12, symbole 2P+T hors du mur ; notice p. 11 « X2 prises étanches extérieures »' },
  { id: 'X2', piece: 'Extérieur sud', lv: 'rdc', n: '+x', face: L + SK, postes: [['x', 3.799]], h: 0.40, floor: 'ext', st: 'inf', type: 'prise étanche extérieure Plexo à clapet', mur: 'façade sud, entre la porte de garage et la baie', src: 'p. 12, symbole 2P+T hors du mur ; notice p. 11' },
  { id: 'RN', piece: 'Extérieur nord', lv: 'rdc', n: '-x', face: -SK, postes: [['rob', 7.042]], h: 0.55, floor: 'ext', st: 'inf', type: 'robinet de puisage mural', mur: 'façade nord, entre la fenêtre de la cuisine et l\'angle nord-ouest', src: 'p. 9 et p. 12, symbole robinet « Robinet » ; notice p. 11 « X2 robinets de puisage »' },
  { id: 'RS', piece: 'Extérieur sud', lv: 'rdc', n: '+x', face: L + SK, postes: [['rob', 7.042]], h: 0.55, floor: 'ext', st: 'inf', type: 'robinet de puisage mural', mur: 'façade sud, près de l\'angle sud-ouest', src: 'p. 9 et p. 12, symbole robinet « Robinet » ; notice p. 11' },
  // ---- étage (p. 13)
  { id: 'B1', piece: 'Bains', lv: 'r1', n: '+x', face: T, postes: [['p', 2.849], ['p', 2.999]], h: 1.20, st: 'plan', type: 'prise double 16 A', mur: 'façade nord (nu x 0,36), près de la cloison de l\'escalier', src: 'p. 13, 2 symboles 2P+T « H:1.20m » ; avenant 1 « prise double »' },
  { id: 'D1', piece: 'Salle d\'eau', lv: 'r1', n: '-z', face: 3.09, postes: [['p', 5.000], ['p', 5.150]], h: 1.20, st: 'plan', type: 'prise double 16 A', mur: 'cloison palier (faïence, nu z 3,09), à droite de la vasque vue de face (côté mur nord)', src: 'p. 13, 2 symboles 2P+T « H:1.20m » ; avenant 1 « prise double »' },
  { id: 'P1', piece: 'Palier (dégagement WC)', lv: 'r1', n: '-x', face: 4.83, postes: [['p', 2.900]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'cloison WC / salle d\'eau (nu x 4,83)', src: 'p. 13, symbole 2P+T' },
  { id: 'Dr1', piece: 'Dressing', lv: 'r1', n: '+z', face: 1.57, postes: [['p', 8.079]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'retour du placard côté chambre 1 (nu z 1,57)', src: 'p. 13, symbole 2P+T' },
  { id: 'C1a', piece: 'Chambre 1', lv: 'r1', n: '-z', face: 3.10, postes: [['p', 8.750]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'cloison palier (nu z 3,10), entrée de la chambre', src: 'p. 13, symbole 2P+T' },
  { id: 'C1b', piece: 'Chambre 1', lv: 'r1', n: '+z', face: T, postes: [['p', 9.725]], planA: 9.650, h: 0.65, st: 'inf', type: 'prise 16 A de chevet', mur: 'mur est (nu z 0,36), au-dessus du chevet gauche, côté lit', src: 'p. 13, symbole 2P+T' },
  { id: 'C1c', piece: 'Chambre 1', lv: 'r1', n: '+z', face: T, postes: [['p', 11.930]], planA: 12.139, h: 0.65, st: 'inf', type: 'prise 16 A de chevet', mur: 'mur est (nu z 0,36), au-dessus du chevet droit, côté lit', src: 'p. 13, symbole 2P+T' },
  { id: 'C1d', piece: 'Chambre 1', lv: 'r1', n: '-z', face: 4.17, postes: [['p', 10.939]], h: 1.20, st: 'plan', type: 'prise 16 A à 1,20 m (TV murale)', mur: 'cloison chambre 2 (nu z 4,17), derrière la TV', src: 'p. 13, symbole 2P+T « H:1.20m »' },
  { id: 'C1e', piece: 'Chambre 1', lv: 'r1', n: '-z', face: 4.17, postes: [['p', 11.989], ['rj', 12.139]], h: 0.30, st: 'inf', type: 'prise 16 A + RJ45 (plaque 2 postes)', mur: 'cloison chambre 2 (nu z 4,17), sous le bureau', src: 'p. 13, symbole 2P+T + symbole RJ45 « RJ45 »' },
  { id: 'C2a', piece: 'Chambre 2', lv: 'r1', n: '+z', face: 4.24, postes: [['p', 9.239]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'cloison palier / chambre 1 (nu z 4,24), près de la porte', src: 'p. 13, symbole 2P+T' },
  { id: 'C2b', piece: 'Chambre 2', lv: 'r1', n: '+z', face: 4.24, postes: [['p', 9.710]], planA: 9.940, h: 0.65, st: 'inf', type: 'prise 16 A de chevet', mur: 'cloison chambre 1 (nu z 4,24), au-dessus du chevet gauche, côté lit', src: 'p. 13, symbole 2P+T' },
  { id: 'C2c', piece: 'Chambre 2', lv: 'r1', n: '+z', face: 4.24, postes: [['p', 12.090]], h: 0.65, st: 'inf', type: 'prise 16 A de chevet', mur: 'cloison chambre 1 (nu z 4,24), au-dessus du bord du chevet droit', src: 'p. 13, symbole 2P+T' },
  { id: 'C2d', piece: 'Chambre 2', lv: 'r1', n: '-z', face: D - T, postes: [['p', 11.940]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'façade ouest (nu z 7,54)', src: 'p. 13, symbole 2P+T' },
  { id: 'C3a', piece: 'Chambre 3', lv: 'r1', n: '+z', face: 4.24, postes: [['p', 0.650]], planA: 0.760, h: 0.65, st: 'inf', type: 'prise 16 A de chevet', mur: 'cloison escalier (nu z 4,24), au-dessus du chevet gauche, côté mur (la lampe est côté lit)', src: 'p. 13, symbole 2P+T' },
  { id: 'C3b', piece: 'Chambre 3', lv: 'r1', n: '+z', face: 4.24, postes: [['p', 3.010]], planA: 2.860, h: 0.65, st: 'inf', type: 'prise 16 A de chevet', mur: 'cloison escalier (nu z 4,24), au-dessus du chevet droit, côté lit', src: 'p. 13, symbole 2P+T' },
  { id: 'C3c', piece: 'Chambre 3', lv: 'r1', n: '+z', face: 4.24, postes: [['p', 3.860]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'cloison escalier / palier (nu z 4,24)', src: 'p. 13, symbole 2P+T' },
  { id: 'C3d', piece: 'Chambre 3', lv: 'r1', n: '-z', face: D - T, postes: [['p', 0.929]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'façade ouest (nu z 7,54), près de l\'angle nord-ouest', src: 'p. 13, symbole 2P+T' },
  { id: 'Bu1', piece: 'Bureau', lv: 'r1', n: '+x', face: 5.09, postes: [['p', 7.040]], h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'cloison chambre 3 (nu x 5,09)', src: 'p. 13, symbole 2P+T' },
  { id: 'Bu2', piece: 'Bureau', lv: 'r1', n: '+z', face: 4.24, postes: [['p', 7.040]], planA: 6.890, h: 0.30, st: 'inf', type: 'prise 16 A', mur: 'cloison palier (nu z 4,24), entre le bout du canapé-lit et le chambranle de la porte', src: 'p. 13, symbole 2P+T' },
  { id: 'Bu3', piece: 'Bureau', lv: 'r1', n: '-x', face: 8.07, postes: [['rj', 6.790], ['p', 6.938]], h: 0.30, st: 'inf', type: 'RJ45 + prise 16 A (plaque 2 postes)', mur: 'cloison chambre 2 (nu x 8,07), sous le bureau', src: 'p. 13, symbole RJ45 « RJ45 » + symbole 2P+T' },
  // ---- extérieur étage : prises RJ45 pour caméras IP (avenant 1), boîtiers Plexo
  { id: 'I1', piece: 'Extérieur nord (angle nord-est)', lv: 'r1', n: '-x', face: -SK, postes: [['x', 0.459]], h: 5.25, floor: 0, st: 'inf', type: 'prise RJ45 extérieure (caméra IP), boîtier Plexo', mur: 'façade nord, sous le débord de toit', src: 'p. 13, symbole RJ45 « RJ45 IP » ; avenant 1 « prises RJ 45 IP pour caméra extérieure » ×3' },
  { id: 'I2', piece: 'Extérieur sud (angle sud-est)', lv: 'r1', n: '+x', face: L + SK, postes: [['x', 0.459]], h: 5.25, floor: 0, st: 'inf', type: 'prise RJ45 extérieure (caméra IP), boîtier Plexo', mur: 'façade sud, sous le débord de toit', src: 'p. 13, symbole RJ45 « RJ45 IP » ; avenant 1' },
  // plan : x 12,44, à 10 cm au nord de la descente EP (x 12,54 au plan) ; la descente de la maquette est en x 12,44 → 12,52 : même écart de 10 cm gardé
  { id: 'I3', piece: 'Extérieur ouest (angle sud-ouest)', lv: 'r1', n: '+z', face: D + SK, postes: [['x', 12.38]], planA: 12.440, h: 5.25, floor: 0, st: 'inf', type: 'prise RJ45 extérieure (caméra IP), boîtier Plexo', mur: 'façade ouest, sous le débord de toit, au nord de la descente EP', src: 'p. 13, symbole RJ45 « RJ45 IP » (x 12,44) ; avenant 1' },
];

const ENT = 0.071, PW = 0.080, PT = 0.008; // Dooxie : entraxe des postes, plaque 80 × 80, saillie
const NRM: Record<string, Vec3> = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };

// sol fini sous l'appareil : sol de la pièce (étage, garage), terrasse, ou terrain au pied de la façade (25 cm devant le nu)
function floorOf(ctx, p, a) {
  if (p.floor === 'terr') return TERR;
  if (p.floor === 'ext') { const [nx, , nz] = NRM[p.n]; const x = nx ? p.face + nx * 0.25 : a, z = nx ? a : p.face + nz * 0.25; return ctx.hAt(x, z); }
  if (typeof p.floor === 'number') return p.floor;
  return p.lv === 'r1' ? E1 : 0;
}
// centre de la plaque (monde) et hauteur absolue de l'axe ; utilisé aussi pour prises.md
export function placeOf(p: Prise, ground: number) {
  const a = p.postes.reduce((s, q) => s + q[1], 0) / p.postes.length, nx = NRM[p.n][0];
  return { x: nx ? p.face : a, z: nx ? a : p.face, y: ground + p.h, a };
}

export function buildPrises(ctx: Ctx) {
  const { M, std, groups } = ctx;
  M.prBlanc = std({ color: '#f6f6f3', roughness: 0.3 }); // plaque et mécanisme Dooxie blanc brillant
  M.prPuits = std({ color: '#d4d4cf', roughness: 0.5 }); // fond du puits (ombré)
  M.prOmbre = std({ color: '#8e8e8a', roughness: 0.6 }); // bord du puits
  M.prNoir = std({ color: '#1c1d1f', roughness: 0.65 }); // alvéoles, prise RJ45
  M.prTerre = std({ color: '#c6c9cb', roughness: 0.3, metalness: 0.8 }); // broche de terre
  M.prPlexo = std({ color: '#a7abac', roughness: 0.45 }); // Plexo gris (teinte supposée)
  M.prClapet = std({ color: '#b6babb', roughness: 0.35 });
  M.robChrome = std({ color: '#f0f2f4', roughness: 0.2, metalness: 0.9 }); // laiton chromé
  M.robFilet = std({ color: '#b9bdc0', roughness: 0.35, metalness: 0.9 });
  const BK = new Map();
  const put = (layer, mat, geo, m4) => {
    let g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('uv'); g.applyMatrix4(m4);
    const k = layer + '|' + mat; let b = BK.get(k); if (!b) BK.set(k, b = { layer, mat, list: [] }); b.list.push(g);
  };
  // repère local : x à droite face au mur, y vers le haut, z sortant du mur ; origine sur le nu
  const frame = (n, x, y, z) => { const zL = new THREE.Vector3(...NRM[n]), yL = new THREE.Vector3(0, 1, 0), xL = new THREE.Vector3().crossVectors(yL, zL); return new THREE.Matrix4().makeBasis(xL, yL, zL).setPosition(x, y, z); };
  const cylZ = (r, z0, z1, seg, x = 0, y = 0) => new THREE.CylinderGeometry(r, r, z1 - z0, seg).rotateX(Math.PI / 2).translate(x, y, (z0 + z1) / 2);
  const cylY = (r, y0, y1, seg, x = 0, z = 0) => new THREE.CylinderGeometry(r, r, y1 - y0, seg).translate(x, (y0 + y1) / 2, z);
  const disc = (r, seg, x, y, z) => new THREE.CircleGeometry(r, seg).translate(x, y, z);
  const boxL = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const plate = (w, h, t, r) => {
    const s = new THREE.Shape(), a = w / 2, b = h / 2;
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.absarc(a - r, -b + r, r, -Math.PI / 2, 0); s.lineTo(a, b - r); s.absarc(a - r, b - r, r, 0, Math.PI / 2);
    s.lineTo(-a + r, b); s.absarc(-a + r, b - r, r, Math.PI / 2, Math.PI); s.lineTo(-a, -b + r); s.absarc(-a + r, -b + r, r, Math.PI, Math.PI * 1.5);
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 3 });
  };

  // poste Dooxie (prise 2P+T à puits, prise 32 A, RJ45) centré en ox sur la plaque
  function dooxiePoste(layer, m4, type, ox) {
    const zf = PT + 0.0004;
    if (type === 'rj') { // RJ45 : prise sous volet, ouverture sombre
      put(layer, 'prNoir', new THREE.PlaneGeometry(0.0155, 0.0135).translate(ox, -0.002, zf), m4);
      put(layer, 'prOmbre', new THREE.PlaneGeometry(0.022, 0.0015).translate(ox, 0.0095, zf), m4);
      return;
    }
    const big = type === 'p32', rp = big ? 0.0235 : 0.0185, rh = big ? 0.0042 : 0.0028, dx = big ? 0.0125 : 0.0095;
    put(layer, 'prPuits', disc(rp, 18, ox, 0, zf), m4);
    put(layer, 'prOmbre', new THREE.RingGeometry(rp, rp + 0.0016, 18).translate(ox, 0, zf), m4);
    for (const s of [-1, 1]) put(layer, 'prNoir', disc(rh, 8, ox + s * dx, 0, zf + 0.0004), m4);
    put(layer, 'prTerre', cylZ(big ? 0.003 : 0.0022, zf, zf + 0.003, 8, ox, big ? 0.0135 : 0.0105), m4); // broche de terre (prise française)
  }
  // Plexo saillie étanche : boîtier, clapet relevable, charnière, ergot, presse-étoupe en dessous
  function plexo(layer, m4) {
    put(layer, 'prPlexo', boxL(-0.036, 0.036, -0.036, 0.036, 0, 0.040), m4);
    put(layer, 'prClapet', boxL(-0.031, 0.031, -0.031, 0.030, 0.040, 0.050), m4);
    put(layer, 'prPlexo', new THREE.CylinderGeometry(0.004, 0.004, 0.056, 8).rotateZ(Math.PI / 2).translate(0, 0.031, 0.046), m4);
    put(layer, 'prClapet', boxL(-0.009, 0.009, -0.037, -0.030, 0.042, 0.053), m4);
    put(layer, 'prPlexo', cylY(0.0068, -0.049, -0.036, 10, 0, 0.020), m4);
  }
  // robinet de puisage mural laiton chromé : rosace, corps à boisseau, poignée papillon quart de tour, nez fileté vers le bas, raccord à écrou
  function robinet(layer, m4) {
    const prof = [[0, 0], [0.027, 0], [0.027, 0.006], [0.024, 0.010], [0.012, 0.013], [0.012, 0.046], [0.017, 0.050], [0.0195, 0.058], [0.0195, 0.074], [0.017, 0.082], [0.011, 0.087], [0, 0.088]];
    put(layer, 'robChrome', new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 16).rotateX(Math.PI / 2), m4);
    const zc = 0.066;
    put(layer, 'robChrome', cylY(0.0075, 0.012, 0.036, 12, 0, zc), m4); // tige de manœuvre
    put(layer, 'robChrome', cylY(0.011, 0.034, 0.040, 12, 0, zc), m4); // carré de la poignée
    put(layer, 'robChrome', boxL(-0.030, 0.030, 0.037, 0.043, zc - 0.008, zc + 0.008), m4); // papillon (fermé : en travers)
    for (const s of [-1, 1]) put(layer, 'robChrome', cylY(0.010, 0.037, 0.043, 12, s * 0.030, zc), m4);
    put(layer, 'robChrome', cylY(0.0105, -0.046, -0.012, 12, 0, zc), m4); // nez
    put(layer, 'robFilet', cylY(0.0118, -0.060, -0.046, 12, 0, zc), m4); // filetage 20 × 27
    put(layer, 'robChrome', new THREE.CylinderGeometry(0.0165, 0.0165, 0.016, 6).translate(0, -0.068, zc), m4); // écrou du raccord
    put(layer, 'robChrome', cylY(0.0090, -0.092, -0.076, 12, 0, zc), m4); // embout de raccord
    put(layer, 'robChrome', cylY(0.0105, -0.088, -0.084, 12, 0, zc), m4);
  }

  for (const p of PRISES) {
    const n = p.postes.length, k0 = p.postes[0][0];
    const a0 = p.postes.reduce((s, q) => s + q[1], 0) / n, ground = floorOf(ctx, p, a0), { x, y, z } = placeOf(p, ground);
    const m4 = frame(p.n, x, y, z);
    if (k0 === 'rob') { robinet(p.lv, m4); continue; }
    if (k0 === 'x') { plexo(p.lv, m4); continue; }
    put(p.lv, 'prBlanc', plate(PW + (n - 1) * ENT, PW, PT, 0.008), m4);
    // postes dans l'ordre du plan, au pas de 71 mm ; sens de lecture : abscisse croissante le long du mur
    const sorted = [...p.postes].sort((q, r) => q[1] - r[1]), sx = new THREE.Vector3(...NRM[p.n]).cross(new THREE.Vector3(0, -1, 0)); // +1 si l'abscisse croît vers la droite
    const dir = (NRM[p.n][0] ? sx.z : sx.x) >= 0 ? 1 : -1;
    sorted.forEach(([t], i) => dooxiePoste(p.lv, m4, t, dir * (i - (n - 1) / 2) * ENT));
  }
  for (const b of BK.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(b.list, false), M[b.mat]);
    mesh.name = 'prises et robinets'; mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.navSkip = true; // trop petits pour l'ombre et les collisions
    groups[b.layer].add(mesh);
  }
}
