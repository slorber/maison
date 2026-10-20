// Relief : limites de la parcelle, points levés, terrain fini, profil de la rue des Merlettes, allée et murets ; hAt(x, z) donne le niveau du sol
import { L, D } from '../maison/plan';
import { clamp, smooth } from '../noyau/outils';
import { envGround } from './env';

// ---------------------------------------------------------------- terrain et abords
// Limites (plan de masse PCMI 2) : B angle de muret nord-est, A nord-ouest (rue), D sud-ouest (angle des rues), C sud-est
export const BND = { A: [-11.53, 12.50], B: [-11.46, 0], C: [19.41, 0], D: [19.52, 13.70] };
export const zWest = x => BND.A[1] + (BND.D[1] - BND.A[1]) * (x - BND.A[0]) / (BND.D[0] - BND.A[0]);
export const xSouth = z => BND.C[0] + (BND.D[0] - BND.C[0]) * z / BND.D[1];
// points altimétriques, relatifs au RDC 55,70, aux positions relevées sur le plan de masse (page 4, 1/200) et le plan altimétrique du géomètre :
// terrain naturel de la parcelle (bornes A et D comprises), angles de la maison (Castelord), rue des Merlettes branche ouest (S…), branche sud (R…).
// Branche sud et carrefour : la surface interpolée est celle de la chaussée (le trottoir d'en face est posé 10 cm au-dessus : R6, 54,92, entré à 54,82) ;
// fit : points dont l'interpolation est recalée (au mm) sur la valeur levée. Branche ouest : profil en travers explicite (RUE, ci-dessous).
const PTS = [
  [-10.51, 0.87, -0.15], [-10.10, 6.11, -0.06], [-10.23, 11.44, 0.08], [-11.52, 12.50, 0.37], // 55,55 55,64 55,78, borne A 56,07
  [0.86, 0.24, -0.47], [0.54, 7.51, -0.29], [0.48, 11.85, -0.21], [8.86, 1.57, -0.55], [9.84, 6.52, -0.34], [9.87, 11.90, -0.36], // 55,23 55,41 55,49 55,15 55,36 55,34
  [18.01, 1.10, -0.76], [18.00, 6.48, -0.54], [17.96, 11.97, -0.46], [19.52, 13.70, -0.50, 1], // 54,94 55,16 55,24, borne D 55,20
  [0, 0, -0.47], [0, D, -0.29], [L, D, -0.44], [L, 0, -0.65], // TN aux angles de la maison (plan de masse Castelord)
  [-9.90, 13.04, 0.24], [-11.49, 14.48, 0.23], [-2.86, 13.27, 0.13], [-2.81, 13.53, 0.03], [-3.05, 14.92, 0.07], [4.45, 13.27, -0.06], [4.40, 13.71, -0.16], // S1 à S7
  [4.73, 16.31, -0.13], [5.26, 17.23, -0.17], [5.77, 18.02, -0.14], [-13.02, 16.45, 0.18], [-14.27, 17.17, 0.27], // S8 à S12
  [18.04, 14.44, -0.67], [17.70, 16.06, -0.65], [18.11, 17.83, -0.70], [18.42, 17.75, -0.72], // S13 à S16 (S17, 55,13, angle du trottoir d'en face : RUE)
  [19.86, 10.85, -0.75, 1], [21.77, 0.38, -0.88, 1], [25.11, 1.44, -0.91, 1], [22.64, 10.60, -0.85, 1], [24.49, 10.44, -0.88, 1], [25.36, 10.40, -0.88, 1], // R1 à R6
  [21.95, 16.71, -0.76, 1], [24.70, 17.68, -0.73, 1], // R7, R8
];
const PTV = PTS.map(p => p[2]); // valeurs entrées dans l'interpolation (recalées pour les points fit)
let PLANE = [0, 0, 0];
export function fitPlane() {
  // tendance régionale figée : plan ajusté sur le semis de points d'origine (avant recalage sur le plan) ; le terrain lointain et le jardin du voisin est ne bougent pas
  PLANE = [-0.026991, 0.014562, -0.315343];
  // recalage de l'interpolation sur les points fit (Gauss-Seidel) : la chaussée passe par les cotes levées
  for (let it = 0; it < 80; it++) PTS.forEach((p, i) => { if (p[3]) PTV[i] += 0.9 * (p[2] - baseH(p[0], p[1])); });
}
const planeAt = (x, z) => PLANE[0] * clamp(x, -45, 45) + PLANE[1] * clamp(z, -35, 40) + PLANE[2];
// jardin de pluie 14 m² en haricot, plus épais dans l'angle sud-ouest (demande des clients du 11/10/2026), pourtour à 55,20, fond 30 cm plus bas (54,90)
export const RAIN = [[18.35, 5.3], [18.35, 6.25], [18.35, 7.2], [18.35, 8.15], [18.35, 9.1], [18.35, 10.05], [18.35, 11.0], [18.34, 11.21], [18.3, 11.41], [18.23, 11.61], [18.14, 11.8], [18.02, 11.97], [17.88, 12.13], [17.72, 12.27], [17.55, 12.39], [17.36, 12.48], [17.16, 12.55], [16.96, 12.59], [16.75, 12.6], [16.39, 12.6], [16.03, 12.6], [15.68, 12.6], [15.32, 12.6], [14.96, 12.6], [14.6, 12.6], [14.42, 12.56], [14.26, 12.46], [14.16, 12.31], [14.12, 12.12], [14.16, 11.94], [14.26, 11.79], [14.42, 11.69], [14.6, 11.65], [14.84, 11.57], [15.08, 11.46], [15.3, 11.33], [15.51, 11.17], [15.71, 10.99], [15.9, 10.79], [16.08, 10.56], [16.25, 10.3], [16.4, 10.02], [16.55, 9.72], [16.68, 9.39], [16.81, 9.03], [16.92, 8.65], [17.02, 8.25], [17.11, 7.82], [17.19, 7.36], [17.26, 6.89], [17.32, 6.38], [17.36, 5.85], [17.4, 5.3], [17.44, 5.12], [17.54, 4.96], [17.69, 4.86], [17.88, 4.83], [18.06, 4.86], [18.21, 4.96], [18.31, 5.12]]; // haricot de 14 m², plus épais dans l'angle sud-ouest
export function polyInfo(poly, x, z) {
  let inside = false, dmin = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    const dx = xj - xi, dz = zj - zi, l2 = dx * dx + dz * dz; const t = clamp(((x - xi) * dx + (z - zi) * dz) / l2, 0, 1);
    dmin = Math.min(dmin, Math.hypot(x - xi - t * dx, z - zi - t * dz));
  }
  return { inside, d: dmin };
}
function baseH(x, z) {
  let sw = 0, sv = 0;
  PTS.forEach(([px, pz], i) => { const d2 = (x - px) ** 2 + (z - pz) ** 2; const w = 1 / (d2 + 1.5) ** 1.6; sw += w; sv += w * (PTV[i] - planeAt(px, pz)); });
  return planeAt(x, z) + sv / sw;
}
// ---------------------------------------------------------------- rue des Merlettes, branche ouest : profil en travers levé
// Plan de masse (page 4) et plan altimétrique du géomètre ; décalages o depuis la limite A–D (z = zWest(x) + o), niveaux relatifs au RDC 55,70.
// Notre côté : trottoir en enrobé (comme celui du voisin nord) de la limite au dos de la bordure, bordure de 15 cm, fil d'eau au pied (trait violet du plan) ;
// chaussée bombée ; en face : caniveau béton de 30 cm, fil d'eau au pied de la bordure de 17 cm (trait noir du plan), trottoir en enrobé jusqu'aux nus d'en face.
const pwl = (K, ex = false) => x => { // interpolation linéaire par morceaux ; constante aux bouts, ou prolongée au sud (ex)
  if (x <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (x <= K[i][0]) { const [a, va] = K[i - 1], [b, vb] = K[i]; return va + (vb - va) * (x - a) / (b - a); }
  const [a, va] = K[K.length - 2], [b, vb] = K[K.length - 1]; return ex ? vb + (vb - va) * (x - b) / (b - a) : vb;
};
type Profil = (x: number) => number;
// profil de la branche ouest ; road, panO, front, xFS, xS6 et y sont ajoutés juste après
export const RUE: { oG: Profil; oW: Profil; oF: Profil; XR: number; XRW: number; PC: number[][]; FE: Profil; FEW: Profil; SW: Profil; SWo: Profil; BOMB: Profil;
  road?: (x: number, o: number) => number; panO?: Profil; front?: Profil; xFS?: Profil; xS6?: Profil; y?: (x: number, o: number) => number } = {
  // tracés : fil d'eau de notre bordure (au nord de A : tireté du plan altimétrique, tenu à 0,45), fil d'eau d'en face, nus d'en face (tireté au nord de −11,3)
  oG: pwl([[-15.0, 0.45], [-11.52, 0.462], [-9.86, 0.476], [4.44, 0.591], [12.97, 0.684], [18.34, 0.730]]),
  oW: pwl([[-45, 3.880], [-13.02, 4.004], [5.258, 4.075], [11.904, 4.098], [18.11, 4.188]]),
  oF: pwl([[-43, 5.48], [-26, 5.36], [-11.3, 5.33], [-9.9, 5.34], [0, 5.39], [5.5, 5.44], [10, 5.48], [15, 5.53], [16.9, 5.55], [17.08, 5.58]]),
  XR: 18.40, XRW: 18.10, // face sud du retour de notre bordure vers la limite ; fil d'eau du retour de la bordure d'en face (vers le pan coupé du n° 4)
  PC: [[17.08, 19.18], [19.34, 21.16]], // pan coupé du n° 4, à l'angle des deux branches
  // niveaux levés : fils d'eau de notre côté (S1, S4, S7, S13) et d'en face (S11, S9, S15), dessus de notre trottoir (borne A, S3, S6 ; au sud : S13 + 0,10),
  // trottoir d'en face (S12, S10, S17), bombement de la chaussée au-dessus de la corde des deux fils d'eau (S2, S5, tampon S8, S14)
  FE: pwl([[-9.90, 0.24], [-2.81, 0.03], [4.40, -0.16], [18.04, -0.67]], true),
  FEW: pwl([[-13.02, 0.18], [5.26, -0.17], [18.11, -0.70], [18.42, -0.72]]), // + grille d'avaloir S16
  SW: pwl([[-11.52, 0.37], [-2.86, 0.13], [4.45, -0.06], [18.04, -0.57]], true),
  SWo: pwl([[-14.27, 0.27], [5.77, -0.14], [18.10, -0.57]], true),
  BOMB: pwl([[-11.49, 0.029], [-3.05, 0.055], [4.73, 0.042], [17.70, 0.020]]),
};
RUE.road = (x, o) => { const a = RUE.oG(x), b = RUE.oW(x), u = clamp((o - a) / (b - a), 0, 1); return RUE.FE(x) + (RUE.FEW(x) - RUE.FE(x)) * u + RUE.BOMB(x) * 4 * u * (1 - u); };
RUE.panO = x => { const [[x0, z0], [x1, z1]] = RUE.PC; return z0 + (z1 - z0) * (x - x0) / (x1 - x0) - zWest(x); };
RUE.front = x => x <= RUE.PC[0][0] ? RUE.oF(x) : RUE.panO(x); // nu des clôtures d'en face (pan coupé au sud)
// branche sud, rive d'en face (fonctions de z) : fil d'eau (trait violet du plan, x 24,52 → 24,60, de z 5,75 à 30,8), nu des propriétés (tireté, x 25,48 → 25,54)
RUE.xFS = pwl([[5.75, 24.52], [13.58, 24.54], [22.71, 24.60], [30.82, 24.58]]);
RUE.xS6 = z => 25.468 + 0.00339 * z;
// dessus fini en (x, o) : trottoir et bordure de notre côté, chaussée et caniveau, bordure et trottoir d'en face (au nord des retours)
RUE.y = (x, o) => { if (o < RUE.oG(x) && x < RUE.XR) return RUE.SW(x); if (o > RUE.oW(x) && x < RUE.XRW) return RUE.SWo(x); return RUE.road(x, o); };
// sol dans l'emprise de la rue : enveloppe basse et lisse des dessus (rampes sous les bordures), le maillage du terrain reste dessous ;
// au-delà des murs : raccord au terrain interpolé ; carrefour : surface interpolée des points levés (branche sud)
function rueGround(x, z, h) {
  if (x > 19.6) return h;
  const o = z - zWest(x), oF = RUE.front(x);
  if (o < -0.6 || o > oF + 2.6) return h;
  const g = RUE.oG(x), w = RUE.oW(x), fe = RUE.FE(x), few = RUE.FEW(x);
  const sw = RUE.SW(x) + (fe - RUE.SW(x)) * smooth(17.95, RUE.XR, x), swo = RUE.SWo(x) + (few - RUE.SWo(x)) * smooth(17.6, RUE.XRW, x);
  let r;
  if (o < g) r = sw + (fe - sw) * clamp((o - g + 0.45) / 0.35, 0, 1); // au niveau du fil d'eau 10 cm avant le pied de la bordure
  else if (o <= w) r = RUE.road(x, o);
  else r = few + (swo - few) * clamp((o - w - 0.08) / 0.32, 0, 1);
  if (o < 0) r += (h - r) * smooth(0, -0.25, o);
  else if (o > oF) r += (h - r) * smooth(oF + 0.5, oF + 2.5, o);
  return x < 18.4 ? r : r + (h - r) * smooth(18.4, 19.6, x);
}
// Terrain fini (clients, 11/10/2026) : 55,53 (−0,17) au pied de la maison et sur toute la partie ouest et sud,
// pente douce jusqu'au pourtour du jardin de pluie à 55,20 (−0,50), palier de 1 m à 55,53 devant la porte-fenêtre sud,
// descente de garage du seuil du garage (−0,13) au seuil du portail coulissant (−0,80, niveau de la rue)
const TF = -0.17, TF_RAIN = -0.50;
export const NB_TOP = 0.45; // dessus du muret du voisin nord, de niveau : NGF 56,15 (hauteur inférée : 0,62 au-dessus de notre jardin)
export const driveH = x => -0.13 + (-0.80 + 0.13) * clamp((x - L) / (19.25 - L), 0, 1);
export const surfAllee = x => driveH(x) + 0.025; // dessus fini de l'allée : le gravillon est posé 2,5 cm au-dessus du terrain
// Allée du garage, jardin et portail coulissant (demandes de Sébastien du 11/10/2026) :
// - muret allée / jardin déplacé de 20 cm vers l'allée : nu côté allée à z 3,77, épaisseur 15 cm (porte de garage, z 0,43 → 2,93, dégagée) ;
// - seuil du portail coulissant en béton enduit ton pierre, de la limite + 0,20 à + 0,62 (+ 0,80 dans la niche du moteur), sur toute la course du vantail ;
//   muret de soutènement le long du seuil (t 0,62 → 0,80), décroché en niche derrière le moteur (t 0,80 → 0,98, s 9,25 → angle des murets)
//   et retourné jusqu'à la clôture au bout de la course (retour z 7,80 → 8,00), dessus horizontal à la hauteur du bout du muret allée / jardin ;
// Reprise du muret et de la marche (Sébastien, 12/10/2026) :
// - muret allée / jardin du nu de l'enduit de la façade sud jusqu'à la niche du moteur du portail ; dessus et chaperon rectilignes,
//   à pente constante de 6,5 % (+0,03 au nu de la façade, −0,33 au bout), sans suivre le terrain : 10 cm au moins au-dessus du sol
//   le plus haut de part et d'autre (allée près de la maison, pelouse ensuite), 18 cm au plus ; c'est le pied qui s'adapte au sol ;
// - marche dans le muret : passage de 0,80 m centré à 2,00 m de la façade sud, contremarche au nu côté allée (aucun débord sur le gravillon),
//   giron de 25 cm (épaisseur du muret + 10 cm côté jardin) au niveau de la pelouse, presque à plat (2 % vers le portail, juste pour l'eau ;
//   choix du client du 12/10), 10 cm sous le dessus du muret au milieu du passage.
export const MUR = { z: 3.77, e: 0.15, y0: 0.03, k: -0.065 };
export const murY = x => MUR.y0 + MUR.k * (x - L); // dessus du muret allée / jardin (sous le chaperon de 3 cm)
export const SEUIL = { t0: 0.20, t1: 0.62, tn: 0.80, tm: 0.98, zRet: 8.00, zNiche: 4.45 }; // profondeurs t depuis la limite sud ; zNiche : bout de la niche (s 9,25)
export const MARCHE: { x0: number; x1: number; zB: number; dJ: number; xc?: number } = { x0: L + 1.60, x1: L + 2.40, zB: MUR.z + 0.25, dJ: 0.10 };
MARCHE.xc = (MARCHE.x0 + MARCHE.x1) / 2;
// dessus du giron, pente de 2 % vers le portail : contremarche de 8 cm côté maison à 15 cm côté portail au-dessus du gravillon (l'allée descend de 10,5 %)
export const marcheY = x => murY(MARCHE.xc) - MARCHE.dJ - 0.02 * (x - MARCHE.xc);
function gardenH(x, z) {
  const ri = polyInfo(RAIN, x, z);
  if (ri.inside) return TF_RAIN - 0.30 * smooth(0, 0.40, ri.d); // cuvette d'infiltration : fond 30 cm sous le pourtour (demande client du 12/10), talus de 40 cm
  const h = TF_RAIN + (TF - TF_RAIN) * smooth(0, 3.4, ri.d);
  const dH = Math.hypot(Math.max(-x, 0, x - L), Math.max(-z, 0, z - D));
  return h + (TF - h) * (1 - smooth(1.0, 1.5, dH));
}
function hAt0(x, z) {
  let h = baseH(x, z);
  // voisin est : jardin surélevé derrière son mur de soutènement en limite
  if (z < -0.18) h += 0.85 * smooth(-0.18, -0.4, z) * smooth(-28, -26, x) * (1 - smooth(19.0, 19.3, x));
  h = envGround(x, z, h); // fosse de son allée de garage en sous-sol, le long de la limite (env.ts)
  h = rueGround(x, z, h); // rue des Merlettes, branche ouest (profil levé)
  // dN : distance à la limite nord A–B (muret du voisin, 16 cm, côté voisin) ; le terrain fini va jusque sous le muret
  const dS = Math.min(zWest(x) - z, xSouth(z) - x), dN = x - (BND.B[0] + (BND.A[0] - BND.B[0]) * z / BND.A[1]);
  if (dS > 0 && z > -0.05 && dN > -0.14) {
    // seuil du portail coulissant et zone de refoulement, jusqu'au nu côté jardin du muret de soutènement (niche du moteur comprise) ;
    // allée jusqu'au nu côté jardin du muret allée / jardin : les ressauts du maillage du terrain restent dans l'épaisseur des murets
    const slide = z < SEUIL.zRet && x > xSouth(z) - (z < SEUIL.zNiche ? SEUIL.tm : SEUIL.tn);
    let tf;
    if (x > L - 0.01 && (z < MUR.z + MUR.e || slide)) tf = driveH(x);
    else { // jardin ; pelouse au niveau du giron de la marche à son bord arrière et sur ses côtés, raccordée sur 50 cm ; sous le giron : 3 cm plus bas
      tf = gardenH(x, z);
      const dm = Math.hypot(Math.max(0, Math.abs(x - MARCHE.xc) - (MARCHE.x1 - MARCHE.x0) / 2), Math.max(0, z - MARCHE.zB));
      tf = dm > 0 ? tf + (marcheY(x) - tf) * (1 - smooth(0, 0.5, dm)) : marcheY(x) - 0.03;
    }
    // jardin nord (clients, 12/10/2026) : presque plat à 55,53 jusqu'aux limites nord et ouest (raccord au muret du voisin et à la clôture sur rue), ondulé de ±1 cm
    if (x < 0) tf += 0.01 * Math.sin(0.83 * x + 0.6) * Math.sin(0.71 * z + 1.9) * smooth(0, -1.0, x);
    tf += (RUE.SW(x) - 0.03 - tf) * (1 - smooth(0.2, 2.2, dS)) * (1 - smooth(0.55, 1.1, Math.abs(x - (PATH.x0 + PATH.x1) / 2))); // de part et d'autre de l'allée : rampe douce vers le portillon (trottoir)
    const pocket = slide && dS > 0.01; // seuil du portail et poche de refoulement : terrain au niveau du seuil jusqu'à la limite (le raccord au trottoir se fait au nu de la limite)
    // côté ouest : ressaut trottoir / jardin dans l'épaisseur du muret (20 cm), au nu côté rue si le jardin est plus bas, au nu côté jardin s'il est plus haut
    const wW = zWest(x) - z <= xSouth(z) - x ? (tf < h ? smooth(0, 0.04, dS) : smooth(0.16, 0.20, dS)) : smooth(0, 0.22, dS);
    h += (tf - h) * (pocket ? 1 : wW) * smooth(-0.05, 0.05, z) * smooth(-0.14, -0.02, dN);
  }
  return h;
}
// allée piétonne bordurée (choix client) : NGF 55,60 (−0,10) près de l'entrée, légère pente montant vers le portillon (trottoir plus haut)
export const PATH = { x0: -2.0, x1: -1.01, xd: -0.80, z0: 1.79, z1: 2.79, top: -0.10 };
let PATH_END = null;
export function pathTop(z) {
  if (PATH_END === null) PATH_END = hAt0(-1.5, zWest(-1.5));
  const zf = zWest(-1.5); return PATH.top + (PATH_END - PATH.top) * clamp((z - (PATH.z1 + 0.05)) / (zf - PATH.z1 - 0.05), 0, 1);
}
export function hAt(x, z) {
  const inLeg = x > PATH.x0 - 0.06 && x < PATH.x1 + 0.06 && z > PATH.z0 - 0.06 && z < zWest(x) - 0.02;
  const inBranch = x > PATH.x0 - 0.06 && x < PATH.xd && z > PATH.z0 - 0.06 && z < PATH.z1 + 0.06;
  if (inLeg || inBranch) return pathTop(z) - 0.03;
  return hAt0(x, z);
}
