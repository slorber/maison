// Escalier béton 1/4 tournant bas : marches en chêne clair, contremarches, joue et sous-face
import * as THREE from 'three';
import { H, T } from './plan';
import { A } from '../noyau/geometrie';
import { dist2 } from '../noyau/outils';

// ---------------------------------------------------------------- escalier
// Béton 1/4 tournant bas des plans travaux v3 (16 hauteurs de 17,9 cm, nez de la marche 1 à 31 cm du tableau de porte, emmarchement 90
// dans les deux volées : jour de la partie basse à x 1,26 (0,36 + 0,90, poteau du plan p. 10), volée droite de z 3,27 à 4,17 ; giron de la volée
// droite ≈ 24 cm (nez des marches 6 à 15 du plan à x 1,51 … 3,67), arrivée à x 3,91 / +2,87) dans la version retenue par les clients : marche 1 débordante à angle arrondi, marches 2 à 5 légèrement
// balancées, marches en chêne clair, contremarches, joue et sous-face peintes, plinthe à crémaillère.
export function buildStair() {
  const rise = H.r1Floor / 16, xs = 1.26, z0 = 3.03, zs = 3.27, zf = 4.17, xE = 3.91, go = (xE - xs) / 11, rw = 0.45;
  const tt = 0.03, ov = 0.02; // marche bois de 30 mm, nez de marche de 2 cm sur la contremarche peinte
  // ligne de foulée à 45 cm du jour
  const W = j => { if (j <= 1) return [xs - rw, z0 + j * (zs - z0)]; if (j <= 4) { const a = Math.PI - (j - 1) * Math.PI / 6; return [xs + rw * Math.cos(a), zs + rw * Math.sin(a)]; } return [xs + (j - 4) * go, zs + rw]; };
  // départs des nez côté jour : 4,5 / 5,3 / 6,3 / 7,5 cm d'emmarchement au jour pour les marches 2 à 5
  const U = [0, 0.24, 0.285, 0.338, 0.401];
  const I = j => { const u = j <= 4 ? U[j] : 0.24 + (j - 4) * go; return u <= 0.24 ? [xs, z0 + u] : [xs + u - 0.24, zs]; };
  const O = j => { const i = I(j), w = W(j), dx = w[0] - i[0], dz = w[1] - i[1];
    if (dx < -1e-6) { const t = (T - i[0]) / dx, z = i[1] + t * dz; if (z <= zf) return [T, z]; }
    const t = (zf - i[1]) / dz; return [i[0] + t * dx, zf]; };
  const vOut = p => Math.abs(p[0] - T) < 1e-6 ? p[1] - z0 : (zf - z0) + p[0] - T;
  const sof = x => Math.max(0, rise * (4 + (x - xs) / go) - 0.19); // paillasse de 15 cm sous la volée droite
  const sn = new THREE.Vector3(rise, -go, 0).normalize();
  const steps = [];
  // marche 1 débordante (15 cm, angle arrondi R 12 cm) : [point, nature de l'arête qui en part]
  { const d = 0.15, rc = 0.12, pts: [number[], string][] = [[[T, z0], 'nose']];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push([[xs + d - rc + rc * Math.cos(a), z0 + rc + rc * Math.sin(a)], 'nose']); }
    pts.push([[xs + d, zs], 'back'], [[T, zs], 'wall']); steps.push(pts); }
  for (let k = 2; k <= 15; k++) {
    const pts: [number[], string][] = [[I(k - 1), 'nose']]; const o0 = O(k - 1), o1 = O(k);
    pts.push([o0, 'wall']); if (vOut(o0) < zf - z0 - 1e-6 && vOut(o1) > zf - z0 + 1e-6) pts.push([[T, zf], 'wall']);
    pts.push([o1, 'back'], [I(k), 'side']);
    steps.push(pts.filter((q, i, arr) => dist2(q[0], arr[(i + 1) % arr.length][0]) > 1e-6));
  }
  const V = (p, y) => [p[0], y, p[1]];
  const outN = (pts, i) => { // normale horizontale sortante de l'arête i
    const a = pts[i][0], b = pts[(i + 1) % pts.length][0]; let nx = b[1] - a[1], nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    const c = pts.reduce((m, q) => [m[0] + q[0][0] / pts.length, m[1] + q[0][1] / pts.length], [0, 0]);
    if ((c[0] - a[0]) * nx + (c[1] - a[1]) * nz > 0) { nx = -nx; nz = -nz; } return [nx, nz]; };
  const offsetPoly = (pts, off) => pts.map((q, i) => { // décalage des arêtes (onglets)
    const n = pts.length, ip = (i - 1 + n) % n;
    const L1 = (j) => { const a = pts[j][0], b = pts[(j + 1) % n][0], nn = outN(pts, j), o = off(pts[j][1]); return [[a[0] + nn[0] * o, a[1] + nn[1] * o], [b[0] - a[0], b[1] - a[1]]]; };
    const [p1, d1] = L1(ip), [p2, d2] = L1(i); const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) { const nn = outN(pts, i), o = off(pts[i][1]); return [q[0][0] + nn[0] * o, q[0][1] + nn[1] * o]; }
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den; return [p1[0] + d1[0] * t, p1[1] + d1[1] * t]; });
  steps.forEach((pts, idx) => {
    const k = idx + 1, top = k * rise, massif = k <= 5, n = pts.length;
    const bot = p => massif ? 0 : sof(p[0]);
    // noyau béton peint en blanc (contremarches, joue au jour, sous-face) ; marches habillées de chêne clair
    for (let i = 0; i < n; i++) {
      const [a, kind] = pts[i], b = pts[(i + 1) % n][0];
      const mat = kind === 'nose' || kind === 'side' || (kind === 'back' && k === 5) ? 'stairPaint' : null;
      if (!mat) continue; const nn = outN(pts, i);
      A.quadN('rdc', mat, [V(a, bot(a)), V(b, bot(b)), V(b, top - tt), V(a, top - tt)], [nn[0], 0, nn[1]]);
    }
    if (!massif) A.polyN('rdc', 'stairPaint', pts.map(q => V(q[0], bot(q[0]))), [sn.x, sn.y, 0]);
    // marche en chêne avec nez débordant
    const tp = offsetPoly(pts, kind => kind === 'nose' ? ov : 0);
    A.polyN('rdc', 'stairTile', tp.map(q => V(q, top)), [0, 1, 0]);
    A.polyN('rdc', 'stairTile', tp.map(q => V(q, top - tt)), [0, -1, 0]);
    for (let i = 0; i < n; i++) {
      if (pts[i][1] === 'wall' || pts[i][1] === 'back') continue;
      const a = tp[i], b = tp[(i + 1) % n], nn = outN(pts, i);
      A.quadN('rdc', 'stairTile', [V(a, top - tt), V(b, top - tt), V(b, top), V(a, top)], [nn[0], 0, nn[1]]);
    }
    // plinthe à crémaillère (7 cm) peinte en blanc le long des murs
    for (let i = 0; i < n; i++) {
      if (pts[i][1] !== 'wall') continue; const a = pts[i][0], b = pts[(i + 1) % n][0], nn = outN(pts, i), e = 0.009;
      const a2 = [a[0] - nn[0] * e, a[1] - nn[1] * e], b2 = [b[0] - nn[0] * e, b[1] - nn[1] * e];
      A.quadN('rdc', 'stairPaint', [V(a2, top), V(b2, top), V(b2, top + 0.07), V(a2, top + 0.07)], [-nn[0], 0, -nn[1]]);
      A.quadN('rdc', 'stairPaint', [V(a, top + 0.07), V(b, top + 0.07), V(b2, top + 0.07), V(a2, top + 0.07)], [0, 1, 0]);
    }
  });
}
