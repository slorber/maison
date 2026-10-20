// Escalier béton 1/4 tournant bas : marches en chêne clair, contremarches, joue et sous-face
import * as THREE from 'three';
import { T } from './plan';
import { RISE, XS, ZS, ZF, PLAN, I, O, M, GO, Z1, U_CORNER, uOf, soffitY } from './traceEscalier';
import { A } from '../noyau/geometrie';
import { dist2 } from '../noyau/outils';

// ---------------------------------------------------------------- escalier
// Béton 1/4 tournant bas des plans travaux v3 (16 hauteurs de 17,9 cm, emmarchement 90 dans les deux volées), tracé en plan dans
// traceEscalier.ts, dans la version retenue par les clients : marche 1 débordante à angle arrondi, marches balancées dans le tournant,
// marches en chêne clair, contremarches, joue et sous-face peintes, plinthe à crémaillère.
export function buildStair() {
  const rise = RISE, z0 = PLAN.z0, xs = XS, zs = ZS, zf = ZF;
  const tt = 0.03, ov = 0.02; // marche bois de 30 mm, nez de marche de 2 cm sur la contremarche peinte
  const vOut = p => Math.abs(p[0] - T) < 1e-6 ? p[1] - z0 : (zf - z0) + p[0] - T;
  const sof = x => Math.max(0, soffitY(x)); // paillasse de 15 cm sous la volée droite
  const sn = new THREE.Vector3(rise, -GO, 0).normalize();
  const steps = [];
  // marche 1 débordante (15 cm, angle arrondi R 12 cm) : [point, nature de l'arête qui en part] ; si la contremarche de la marche 2
  // est avant l'angle du jour, le débord se prolonge le long du jour jusqu'à l'angle (assise du poteau de départ du garde-corps)
  { const d = 0.15, rc = 0.12, pts: [number[], string][] = [[[T, z0], 'nose']];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push([[xs + d - rc + rc * Math.cos(a), z0 + rc + rc * Math.sin(a)], 'nose']); }
    pts.push([[xs + d, zs], 'back']); if (Z1 < zs - 1e-6) pts.push([[xs, zs], 'back'], [[xs, Z1], 'back']);
    pts.push([[T, Z1], 'wall']); steps.push(pts); }
  for (let k = 2; k <= 15; k++) {
    const pts: [number[], string][] = [[I(k - 1), 'nose']]; const o0 = O(k - 1), o1 = O(k);
    pts.push([o0, 'wall']); if (vOut(o0) < zf - z0 - 1e-6 && vOut(o1) > zf - z0 + 1e-6) pts.push([[T, zf], 'wall']);
    pts.push([o1, 'back'], [I(k), 'side']); if (uOf(k - 1) < U_CORNER - 1e-6 && uOf(k) > U_CORNER + 1e-6) pts.push([[xs, zs], 'side']); // marche à cheval sur l'angle du jour
    steps.push(pts.filter((q, i, arr) => dist2(q[0], arr[(i + 1) % arr.length][0]) > 1e-6));
  }
  const V = (p, y) => [p[0], y, p[1]];
  const area = pts => pts.reduce((m, q, i) => { const b = pts[(i + 1) % pts.length][0]; return m + q[0][0] * b[1] - b[0] * q[0][1]; }, 0);
  const outN = (pts, i) => { // normale horizontale sortante de l'arête i (selon le sens de parcours du contour)
    const a = pts[i][0], b = pts[(i + 1) % pts.length][0], sg = area(pts) > 0 ? 1 : -1; let nx = sg * (b[1] - a[1]), nz = -sg * (b[0] - a[0]); const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    return [nx, nz]; };
  // face plane horizontale ou rampante : éventail si le contour est convexe, sinon triangulation (marches à cheval sur l'angle du jour)
  const fill = (mat, q2, y, n) => {
    const q3 = q2.map(q => V(q, y(q))), m = q2.length;
    const cr = q2.map((q, i) => { const p = q2[(i - 1 + m) % m], r = q2[(i + 1) % m]; return (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]); });
    if (cr.every(c => c > -1e-9) || cr.every(c => c < 1e-9)) { A.polyN('rdc', mat, q3, n); return; }
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(q2.map(q => new THREE.Vector2(q[0], q[1])), [])) A.polyN('rdc', mat, [q3[i], q3[j], q3[k]], n);
  };
  const offsetPoly = (pts, off) => pts.map((q, i) => { // décalage des arêtes (onglets)
    const n = pts.length, ip = (i - 1 + n) % n;
    const L1 = (j) => { const a = pts[j][0], b = pts[(j + 1) % n][0], nn = outN(pts, j), o = off(pts[j][1]); return [[a[0] + nn[0] * o, a[1] + nn[1] * o], [b[0] - a[0], b[1] - a[1]]]; };
    const [p1, d1] = L1(ip), [p2, d2] = L1(i); const den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) { const nn = outN(pts, i), o = off(pts[i][1]); return [q[0][0] + nn[0] * o, q[0][1] + nn[1] * o]; }
    const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den; return [p1[0] + d1[0] * t, p1[1] + d1[1] * t]; });
  steps.forEach((pts, idx) => {
    const k = idx + 1, top = k * rise, massif = k <= M, n = pts.length; // massif jusqu'à la dernière balancée
    const bot = p => massif ? 0 : sof(p[0]);
    // noyau béton peint en blanc (contremarches, joue au jour, sous-face) ; marches habillées de chêne clair
    for (let i = 0; i < n; i++) {
      const [a, kind] = pts[i], b = pts[(i + 1) % n][0];
      const mat = kind === 'nose' || kind === 'side' || (kind === 'back' && k === M) ? 'stairPaint' : null;
      if (!mat) continue; const nn = outN(pts, i);
      A.quadN('rdc', mat, [V(a, bot(a)), V(b, bot(b)), V(b, top - tt), V(a, top - tt)], [nn[0], 0, nn[1]]);
    }
    if (!massif) fill('stairPaint', pts.map(q => q[0]), bot, [sn.x, sn.y, 0]);
    // marche en chêne avec nez débordant
    const tp = offsetPoly(pts, kind => kind === 'nose' ? ov : 0);
    fill('stairTile', tp, () => top, [0, 1, 0]);
    fill('stairTile', tp, () => top - tt, [0, -1, 0]);
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
