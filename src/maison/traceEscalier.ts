// Tracé en plan de l'escalier 1/4 tournant bas, partagé par les marches (escalier), le garde-corps (equip) et le placard (sousEscalier)
import { H, T } from './plan';

// Repères fixes des plans travaux v3 : jour de la partie basse à x 1,26 (0,36 + emmarchement 90, poteau du plan p. 10), volée droite
// de z 3,27 (jour) à 4,17 (cloison cuisine), arrivée à x 3,91 / +2,87 ; ligne de foulée à 45 cm du jour.
export const XS = 1.26, ZS = 3.27, ZF = 4.17, XE = 3.91, RW = 0.45;
export const RISE = H.r1Floor / 16, ARC = Math.PI / 2 * RW; // 16 hauteurs de 17,9 cm ; quart de cercle de la ligne de foulée
type P2 = [number, number];

// Lignes de nez j = 0 … 15 (j : nez de la marche j + 1 ; 15 : arrivée), repérées par leur abscisse s sur la ligne de foulée et u le long
// du jour, toutes deux comptées depuis le nez de la marche 1 (z0). Lignes d'équerre dans les volées droites, balancées entre les deux.
export type StairPlan = { z0: number; s: number[]; u: number[] };

// Variante « balancement symétrique » : marches 2 à 5 balancées symétriquement de part et d'autre de la diagonale du tournant
// (2 = 5 et 3 = 4 : 8,0 / 6,7 / 6,7 / 8,0 cm d'emmarchement au jour), le nez de la marche 4 part de l'angle du jour ; giron de 25,0 cm
// sur la ligne de foulée pour les 15 marches. La symétrie fixe le départ : contremarche de la marche 1 à 15,3 cm du tableau de porte
// (z 2,873), nez à 13,3 cm.
function planSymetrique(): StairPlan {
  // ligne 3 (nez de la marche 4) sur la diagonale : 3 g = a + ARC / 2, avec g = (a + ARC + 2,65) / 15
  const a = (3 * (XE - XS) - 4.5 * ARC) / 12, g = (a + ARC + XE - XS) / 15, j2 = 0.08, j3 = a - g - j2;
  return planGironEgal(ZS - a, [j2, j3, j3]);
}
// Giron constant g sur la ligne de foulée, marche 1 comprise (d'équerre) ; jour : emmarchement au jour des balancées 2, 3 …, la
// dernière balancée prenant le reste jusqu'à la première ligne d'équerre de la volée droite
function planGironEgal(z0: number, jour: number[]): StairPlan {
  const a = ZS - z0, g = (a + ARC + XE - XS) / 15, s = [], u = [0, g];
  for (const d of jour) u.push(u[u.length - 1] + d);
  for (let j = 0; j <= 15; j++) { s.push(j * g); if (j > jour.length + 1) u.push(j * g - ARC); }
  return { z0, s, u };
}

export const PLAN = planSymetrique();

// ---------------------------------------------------------------- géométrie dérivée du tracé
const a = ZS - PLAN.z0; // longueur droite du jour et de la ligne de foulée avant le tournant
const walk = (s: number): P2 => {
  if (s <= a) return [XS - RW, PLAN.z0 + s];
  if (s <= a + ARC) { const t = Math.PI - (s - a) / RW; return [XS + RW * Math.cos(t), ZS + RW * Math.sin(t)]; }
  return [XS + s - a - ARC, ZS + RW];
};
const jour = (u: number): P2 => u <= a ? [XS, PLAN.z0 + u] : [XS + u - a, ZS];
export const W = (j: number) => walk(PLAN.s[j]); // point de la ligne j sur la ligne de foulée
export const I = (j: number) => jour(PLAN.u[j]); // point de la ligne j au jour
export const uOf = (j: number) => PLAN.u[j], U_CORNER = a; // u de l'angle du jour (x 1,26, z 3,27)
// point de la ligne j contre les murs (x = 0,36 le long de la façade nord, z = 4,17 le long de la cloison cuisine)
export const O = (j: number): P2 => {
  const i = I(j), w = W(j), dx = w[0] - i[0], dz = w[1] - i[1];
  if (dx < -1e-6) { const t = (T - i[0]) / dx, z = i[1] + t * dz; if (z <= ZF) return [T, z]; }
  const t = (ZF - i[1]) / dz; return [i[0] + t * dx, ZF];
};
// première ligne d'équerre de la volée droite (fin des balancées) : M ; giron constant GO de XM à l'arrivée
export const M = (() => { let j = 15; while (j > 1 && Math.abs(I(j - 1)[0] - W(j - 1)[0]) < 1e-6 && PLAN.u[j - 1] > a) j--; return j; })();
export const XM = I(M)[0], GO = (XE - XM) / (15 - M);
export const Z1 = I(1)[1]; // contremarche de la marche 2 (fond de la marche 1)
// ligne des nez au jour de la volée droite (hauteur du dessus de marche au droit du nez), prolongée jusqu'au départ
export const noseY = (x: number) => RISE * (M + 1 + (x - XM) / GO);
// sous-face de la paillasse de 15 cm sous la volée droite
export const soffitY = (x: number) => RISE * (M + (x - XM) / GO) - 0.19;
