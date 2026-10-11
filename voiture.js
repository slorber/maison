// Peugeot 5008 (3e génération, 2024–, aussi E-5008), teinte de lancement Vert Olivine, garée en marche avant dans le garage :
// buildVoiture(ctx) est appelé juste après buildMobilier, avant A.build(groups) ; les meshes vont dans ctx.groups.furn0.
// Cotes constructeur (fiches techniques autotijd.be / vehiclesizes.com / caroom.fr) : longueur 4 791, largeur 1 895 hors rétroviseurs
// (2 108 rétroviseurs déployés), hauteur 1 694 (barres de toit comprises), empattement 2 901, porte-à-faux 940 / 950, voies 1 630 / 1 636,
// pneus 235/50 R20 (finition GT). Repère local : u vers l'arrière (0 = bouclier avant), y depuis le sol du garage, v vers l'ouest (+Z).
// Caisse : sections transversales lissées le long de u (loft), matériau choisi facette par facette (peinture, vitrage, noir brillant, noir mat) ;
// tout est fusionné par matériau (9 meshes visibles) ; seule la caisse peinte porte ombre ; un prisme invisible sert aux collisions de la visite.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- cotes (m)
const L = 4.791, W2 = 1.895 / 2, WM2 = 2.108 / 2, HT = 1.694, EMP = 2.901, PAF = 0.940, VAV = 1.630, VAR = 1.636;
const RP = (20 * 25.4 / 2 + 235 * 0.50) / 1000, RJ = 20 * 25.4 / 2000; // pneu 235/50 R20 : rayon 0,3717, jante 0,254
const UAV = PAF, UAR = PAF + EMP; // essieux avant / arrière
const RA = 0.43, WL = 0.60; // découpe des passages de roue (rayon) et paroi intérieure du passage (v)
const U0 = 0.006, U1 = L - 0.003; // la caisse s'arrête 6 / 3 mm en deçà : calandre, logos et diffuseur posés devant restent dans la longueur
const RF = 0.05, RR = 0.04; // arrondis des boucliers (en plan et en élévation)
// placement : nez vers la cloison du local technique (x 7,08) à 0,40 m, centrée sur la baie de la porte de garage (z 1,68), sol à −0,13
const X0 = 7.08 + 0.40, ZC = 1.68, Y0 = -0.13;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

// interpolation cubique monotone (Fritsch-Carlson) : profils sans dépassement entre les points de passage
function mono(K) {
  const n = K.length, xs = K.map(k => k[0]), ys = K.map(k => k[1]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// ---------------------------------------------------------------- silhouette (fonctions de u)
const F = {
  // axe du dessus : bouclier, capot, pare-brise incliné, long pavillon, becquet, lunette, hayon presque vertical
  yt: mono([[0, 0.80], [0.03, 0.855], [0.08, 0.90], [0.15, 0.928], [0.5, 0.975], [0.9, 1.02], [1.15, 1.05], [1.22, 1.062], [1.40, 1.182], [1.60, 1.315], [1.80, 1.448],
    [1.95, 1.548], [2.05, 1.615], [2.20, 1.663], [2.5, 1.680], [3.4, 1.678], [4.0, 1.666], [4.40, 1.650], [4.48, 1.628], [4.535, 1.590], [4.60, 1.42], [4.66, 1.28],
    [4.70, 1.17], [4.72, 1.10], [4.745, 1.00], [4.765, 0.92], [4.78, 0.86], [L, 0.80]]),
  // ligne d'épaule (haut des ailes, pied des vitres) : remonte vers la custode
  yw: mono([[0, 0.775], [0.05, 0.84], [0.15, 0.885], [0.5, 0.935], [1.0, 0.98], [1.3, 1.005], [2.4, 1.035], [3.3, 1.06], [3.6, 1.11], [3.9, 1.16], [4.2, 1.18],
    [4.55, 1.17], [4.66, 1.15], [4.70, 1.09], [4.72, 1.04], [4.75, 0.95], [4.775, 0.86], [L, 0.775]]),
  // haut des vitres latérales : montant de pare-brise, pavillon, montant de custode qui plonge vers la lunette
  yr: mono([[1.30, 1.01], [1.50, 1.15], [1.70, 1.29], [1.90, 1.43], [2.05, 1.548], [2.15, 1.592], [2.4, 1.615], [3.5, 1.612], [4.2, 1.603], [4.45, 1.592], [4.52, 1.562],
    [4.58, 1.46], [4.64, 1.33], [4.70, 1.19], [4.72, 1.10], [4.745, 0.975]]),
  // demi-largeur maximale de caisse (hors élargisseurs d'ailes) : angles avant arrondis, arrière plus carré
  wb: mono([[0, 0.60], [0.02, 0.69], [0.05, 0.77], [0.10, 0.835], [0.18, 0.885], [0.30, 0.917], [0.45, 0.932], [0.6, 0.935], [4.40, 0.935], [4.55, 0.925], [4.65, 0.91],
    [4.72, 0.885], [4.76, 0.85], [4.78, 0.81], [L, 0.76]]),
  // demi-largeur du pavillon (rentré de caisse)
  wr: mono([[1.30, 0.81], [1.70, 0.765], [2.10, 0.715], [4.40, 0.705], [4.55, 0.68], [4.70, 0.64], [4.745, 0.745]]),
  // dessous : angle d'attaque, garde au sol, angle de fuite
  yb: mono([[0, 0.36], [0.08, 0.315], [0.30, 0.27], [0.55, 0.245], [0.9, 0.235], [4.1, 0.235], [4.35, 0.27], [4.55, 0.33], [4.70, 0.39], [L, 0.43]]),
};
// haut des protections noires (bas de boucliers, bas de caisse)
const cladTop = u => u < 0.50 ? 0.44 : u > 4.28 ? 0.47 : 0.375;

// demi-section en u : 43 points du milieu du dessous (j 0) au milieu du dessus (j 42)
// j 0-3 dessous, 4-24 flanc (arrondi du bas de caisse, flanc, épaule), 25 jonc de pied de vitre, 26-31 vitre (ou bande plate d'aile au capot),
// 32-35 arrondi de pavillon, 36-42 dessus (pavillon, pare-brise, capot, lunette, hayon)
const NJ = 43;
function section(u) {
  const yb = F.yb(u), yt = F.yt(u), wb = F.wb(u), wsh = wb - 0.035, yw = Math.min(F.yw(u), yt - 0.02);
  const gh = u > 1.30 && u < 4.745;
  const yr = Math.min(gh ? Math.max(F.yr(u), yw + 0.012) : yw + 0.012, yt - 0.006), wr = gh ? F.wr(u) : wsh - 0.09;
  const P = [], rb = 0.08, vs = wb - 0.012;
  for (let k = 0; k <= 3; k++) P.push([(vs - rb) * k / 3, yb]);
  for (let k = 1; k <= 3; k++) { const a = -Math.PI / 2 + Math.PI / 2 * k / 4; P.push([vs - rb + rb * Math.cos(a), yb + rb + rb * Math.sin(a)]); }
  const yS0 = yb + rb, yS1 = yw - 0.03, yC = clamp(cladTop(u), yS0 + 0.006, yS1 - 0.1);
  for (let k = 0; k <= 16; k++) {
    const y = k <= 3 ? lerp(yS0, yC, k / 3) : lerp(yC, yS1, (k - 3) / 13), s = (y - yS0) / (yS1 - yS0); let v = wb;
    if (s < 0.2) v -= 0.012 * (1 - s / 0.2) ** 2; else if (s > 0.6) v -= (wb - wsh) * ((s - 0.6) / 0.4) ** 2; P.push([v, y]);
  }
  P.push([wsh - 0.012, yw]); P.push([wsh - 0.04, yw + 0.008]);
  const p25 = P[25], pi = [wr + 0.008, Math.max(yr - 0.015, yw + 0.01)];
  for (let k = 1; k <= 6; k++) { const t = k / 6; P.push([lerp(p25[0], pi[0], t) + 0.008 * Math.sin(Math.PI * t), lerp(p25[1], pi[1], t)]); }
  const e = clamp((yt - pi[1]) * 0.45, 0.003, 0.04), rx = 0.058;
  for (let k = 1; k <= 4; k++) { const a = Math.PI / 2 * k / 4; P.push([pi[0] - rx + rx * Math.cos(a), pi[1] + e * Math.sin(a)]); }
  const E = P[P.length - 1];
  for (let k = 1; k <= 7; k++) { const t = (k / 7) ** 1.3; P.push([E[0] * (1 - t), yt - (yt - E[1]) * (1 - t) ** 2]); }
  // arrondis des boucliers : section resserrée vers son centre
  let d = 0;
  if (u < U0 + RF) d = RF - Math.sqrt(Math.max(0, RF * RF - (U0 + RF - u) ** 2));
  if (u > U1 - RR) d = RR - Math.sqrt(Math.max(0, RR * RR - (u - U1 + RR) ** 2));
  if (d > 0) { const yc = (yb + yt) / 2, sy = 1 - 2 * d / (yt - yb), sv = 1 - d / wb; for (const p of P) { p[0] *= sv; p[1] = yc + (p[1] - yc) * sy; } }
  const P0 = P.map(p => p.slice()); // section avant découpe des passages de roue (sert au calcul des normales)
  // passages de roue : les points du flanc à moins de RA du centre de roue rentrent jusqu'à la paroi intérieure (WL)
  const push = new Float32Array(NJ);
  for (let j = 0; j <= 24; j++) {
    const p = P[j]; if (p[0] <= WL) continue;
    for (const uw of [UAV, UAR]) {
      const t = THREE.MathUtils.smoothstep(RA - Math.hypot(u - uw, p[1] - RP), 0, 0.02);
      if (t > 0) { p[0] += (WL - p[0]) * t; push[j] = Math.max(push[j], t); }
    }
  }
  return { P, P0, push, yw, yr, yt, wb, wsh, wr };
}
// demi-largeur du flanc à la hauteur y (pour les traits de portes, poignées) ; null hors flanc
function sideV(u, y) {
  const P = section(u).P;
  for (let j = 4; j < 31; j++) { const a = P[j], b = P[j + 1]; if (y >= a[1] && y <= b[1] && b[1] > a[1]) return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1])); }
  return null;
}
// hauteur du dessus en (u, v) (capot, pavillon) ; null au-delà de l'épaule
function surfY(u, v) {
  const P = section(u).P; v = Math.abs(v);
  for (let j = 24; j < NJ - 1; j++) { const a = P[j], b = P[j + 1]; if (v <= a[0] && v >= b[0] && a[0] > b[0]) return lerp(a[1], b[1], (a[0] - v) / (a[0] - b[0])); }
  return null;
}
// point et normale sur le flanc droit / sur le dessus (différences finies)
function onSide(u, y) {
  const v = sideV(u, y); if (v === null) return null;
  const e = 0.004, du = (sideV(u + e, y) ?? v) - v, dy = (sideV(u, y + e) ?? v) - v;
  return { p: V(u, y, v), n: V(-du / e, -dy / e, 1).normalize() };
}
function onTop(u, v) {
  const y = surfY(u, v); if (y === null) return null;
  const e = 0.004, du = (surfY(u + e, v) ?? y) - y, dv = (surfY(u, v - e) ?? y) - y;
  return { p: V(u, y, v), n: V(-du / e, 1, dv / e).normalize() };
}
// matériau d'une facette de la caisse : u au centre de la facette, j = indice du point haut du segment de demi-section, y moyen, passage de roue
function cls(u, j, y, pushed) {
  if (pushed) return 'matte';
  if (j <= 3) return 'matte';
  if (j <= 24) return j <= 10 ? 'matte' : 'paint'; // j 10 : rangée calée sur le haut des protections
  if (j === 25) return u > 1.30 && u < 4.12 ? 'gloss' : 'paint';
  if (j <= 31) {
    if (u > 1.30 && u <= 1.42) return 'gloss'; // aileron de rétroviseur
    if (!(u > 1.42 && u < 4.12)) return 'paint'; // ailes, montant de custode couleur caisse
    if ((u > 2.30 && u < 2.40) || (u > 3.32 && u < 3.40) || j === 26 || j === 31) return 'gloss'; // montants B et C, encadrements
    return 'glass';
  }
  if (j <= 36) return 'paint'; // arrondi du pavillon, montants de pare-brise et de lunette
  if (u > 1.17 && u < 1.235) return 'gloss'; // grille d'auvent
  if (u >= 1.235 && u < 2.09) return 'glass'; // pare-brise
  if (u > 4.48 && u < 4.535) return 'gloss';
  if (u >= 4.535 && u < 4.70) return 'glass'; // lunette
  return 'paint';
}

// ---------------------------------------------------------------- seaux par matériau
let BK;
// géométrie indexée, attributs position + normale seulement
function clean(g) {
  if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  g.clearGroups(); g.morphAttributes = {};
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
// symétrique par rapport au plan médian (v → −v), triangles retournés
function mir(g) {
  const c = g.clone(); c.scale(1, 1, -1);
  const ix = c.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  c.index.needsUpdate = true; return c;
}
function put(k, g, both) { g = clean(g); BK[k].push(g); if (both) BK[k].push(mir(g)); }
// maillage depuis positions / normales / triangles ; chaque triangle est orienté selon la normale moyenne de ses sommets
function meshFrom(pos, nor, idx) {
  const a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0), n = V(0, 0, 0), m = V(0, 0, 0);
  for (let i = 0; i < idx.length; i += 3) {
    const [i0, i1, i2] = [idx[i], idx[i + 1], idx[i + 2]];
    a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3); c.fromArray(pos, i2 * 3);
    n.subVectors(b, a).cross(c.sub(a)); m.fromArray(nor, i0 * 3).add(b.fromArray(nor, i1 * 3)).add(c.fromArray(nor, i2 * 3));
    if (n.dot(m) < 0) { idx[i + 1] = i2; idx[i + 2] = i1; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
// ruban posé sur une surface : S = [{p, n}] le long de la ligne, largeur w, décollé de off
function ribbon(k, S, w, off, both) {
  S = S.filter(Boolean); if (S.length < 2) return;
  const pos = [], nor = [], idx = [], t = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0);
  S.forEach((s, i) => {
    t.subVectors(S[Math.min(i + 1, S.length - 1)].p, S[Math.max(i - 1, 0)].p).normalize();
    b.crossVectors(t, s.n).normalize().multiplyScalar(w / 2); c.copy(s.p).addScaledVector(s.n, off);
    pos.push(c.x + b.x, c.y + b.y, c.z + b.z, c.x - b.x, c.y - b.y, c.z - b.z); nor.push(...s.n.toArray(), ...s.n.toArray());
    if (i) { const a = 2 * i - 2; idx.push(a, a + 3, a + 1, a, a + 2, a + 3); }
  });
  put(k, meshFrom(pos, nor, idx), both);
}
// pièce de surface : f(a, b) → {p, n} pour a, b dans [0, 1], grille na × nb, décollée de off
function patch(k, f, na, nb, off, both) {
  const S = [];
  for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) S.push(f(i / na, j / nb));
  const pos = [], nor = [], idx = [];
  for (const s of S) { const q = s ? s.p.clone().addScaledVector(s.n, off) : V(0, 0, 0); pos.push(q.x, q.y, q.z); nor.push(...(s ? s.n : V(0, 1, 0)).toArray()); }
  for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
    const a = j * (na + 1) + i, b = a + 1, c = a + na + 1, d = c + 1;
    if (S[a] && S[b] && S[d]) idx.push(a, b, d); if (S[a] && S[d] && S[c]) idx.push(a, d, c);
  }
  if (idx.length) put(k, meshFrom(pos, nor, idx), both);
}
// tube fermé le long d'une suite de sections (anneaux de même nombre de points), extrémités bouchées
function loftRings(rings, caps = true) {
  const n = rings[0].length, pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = (i + 1) * n + j, c = (i + 1) * n + (j + 1) % n, d = i * n + (j + 1) % n; idx.push(a, b, c, a, c, d);
  }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  if (!caps) return g;
  const parts = [g];
  for (const [r, s] of [[rings[0], -1], [rings[rings.length - 1], 1]]) {
    const ctr = r.reduce((m, p) => m.add(p), V(0, 0, 0)).multiplyScalar(1 / n), cp = [ctr.x, ctr.y, ctr.z], ci = [];
    for (const p of r) cp.push(p.x, p.y, p.z);
    for (let j = 0; j < n; j++) s < 0 ? ci.push(0, 1 + (j + 1) % n, 1 + j) : ci.push(0, 1 + j, 1 + (j + 1) % n);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setIndex(ci); cg.computeVertexNormals(); parts.push(cg);
  }
  return mergeGeometries(parts.map(clean), false);
}

// ---------------------------------------------------------------- caisse
function body() {
  const S = new Set();
  for (const d of [0, 0.002, 0.007, 0.015, 0.027, 0.045, 0.07, 0.10, 0.14, 0.19, 0.25, 0.32, 0.40, 0.48]) S.add(U0 + d);
  for (let u = 0.51; u < 1.40; u += 0.03) S.add(u);
  for (let u = 1.40; u < 3.40; u += 0.06) S.add(u);
  for (let u = 3.40; u < 4.30; u += 0.03) S.add(u);
  for (const u of [1.17, 1.235, 1.42, 2.09, 2.30, 2.40, 3.32, 3.40, 4.12, 4.30, 4.34, 4.38, 4.42, 4.45, 4.48, 4.51, 4.535, 4.56, 4.59, 4.62, 4.65, 4.68, 4.70, 4.715, 4.73, 4.745, 4.76, 4.77]) S.add(u);
  for (const d of [0.024, 0.015, 0.008, 0.003, 0]) S.add(U1 - d);
  const us = [...S].map(u => Math.round(u * 1e4) / 1e4).sort((a, b) => a - b).filter((u, i, a) => i === 0 || u - a[i - 1] > 0.0015);
  const NS = us.length, NR = 2 * NJ - 2, pos = new Float32Array(NS * NR * 3), pos0 = new Float32Array(NS * NR * 3), psh = new Float32Array(NS * NR);
  us.forEach((u, i) => {
    const { P, P0, push } = section(u);
    for (let r = 0; r < NR; r++) {
      const j = r < NJ ? r : NR - r, s = r < NJ ? 1 : -1, o = (i * NR + r) * 3;
      pos[o] = pos0[o] = u; pos[o + 1] = P[j][1]; pos[o + 2] = s * P[j][0]; pos0[o + 1] = P0[j][1]; pos0[o + 2] = s * P0[j][0]; psh[i * NR + r] = push[j];
    }
  });
  // triangles et matériau de chaque facette
  const all = [], byMat = {}, probeF = [], probeR = [];
  for (let i = 0; i < NS - 1; i++) for (let r = 0; r < NR; r++) {
    const r1 = (r + 1) % NR, a = i * NR + r, b = (i + 1) * NR + r, c = (i + 1) * NR + r1, d = i * NR + r1;
    const uc = (us[i] + us[i + 1]) / 2, j = r < NJ - 1 ? r + 1 : NR - r, yc = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1] + pos[d * 3 + 1]) / 4;
    const k = cls(uc, j, yc, psh[a] > 0 || psh[b] > 0 || psh[c] > 0 || psh[d] > 0);
    const t = [a, b, c, a, c, d]; all.push(...t); (byMat[k] ||= []).push(...t);
    if (uc < 0.35) probeF.push(...t); if (uc > 4.50) probeR.push(...t);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos0, 3)); g.setIndex(all); g.computeVertexNormals();
  const nor = g.attributes.normal.array;
  // sous-maillage compacté (seuls les sommets utilisés)
  const sub = tris => {
    const map = new Map(), p = [], n = [], ix = [];
    for (const v of tris) { let w = map.get(v); if (w === undefined) { w = map.size; map.set(v, w); p.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); n.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); } ix.push(w); }
    const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); q.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); q.setIndex(ix); return q;
  };
  for (const k of Object.keys(byMat)) put(k, sub(byMat[k]));
  // faces d'extrémité (bouclier avant, bas du bouclier arrière) : éventail plan depuis le centre de la section
  const caps = [];
  for (const [i, s] of [[0, -1], [NS - 1, 1]]) {
    const cp = [], ci = [], cn = []; let cy = 0, cz = 0;
    for (let r = 0; r < NR; r++) { cy += pos[(i * NR + r) * 3 + 1] / NR; cz += pos[(i * NR + r) * 3 + 2] / NR; }
    cp.push(us[i], cy, cz); cn.push(s, 0, 0);
    for (let r = 0; r < NR; r++) { const o = (i * NR + r) * 3; cp.push(pos[o], pos[o + 1], pos[o + 2]); cn.push(s, 0, 0); }
    for (let r = 0; r < NR; r++) ci.push(0, 1 + r, 1 + (r + 1) % NR);
    const cg = meshFrom(cp, cn, ci); put('paint', cg); caps.push(cg);
  }
  // sondes de projection des décors avant / arrière (lancer de rayons sur une partie de la caisse seulement)
  const probe = (tris, cap) => { const m = new THREE.Mesh(mergeGeometries([sub(tris), cap.clone()], false), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.updateMatrixWorld(); return m; };
  return { PF: probe(probeF, caps[0]), PR: probe(probeR, caps[1]), NS, us };
}
const RC = new THREE.Raycaster();
function shoot(probe, o, d) {
  RC.set(o, d); const h = RC.intersectObject(probe, false)[0]; if (!h) return null;
  const n = h.face.normal.clone(); if (n.dot(d) > 0) n.negate(); return { p: h.point.clone(), n };
}

// ---------------------------------------------------------------- face avant : optiques fines, griffes LED, calandre couleur caisse
function lion(depth) { // écusson Peugeot (lion dans un blason) simplifié
  const s = new THREE.Shape(); s.moveTo(-0.040, 0.048); s.lineTo(0.040, 0.048); s.quadraticCurveTo(0.044, -0.018, 0, -0.054); s.quadraticCurveTo(-0.044, -0.018, -0.040, 0.048);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
}
function avant(PF) {
  const fr = (v, y) => shoot(PF, V(-1, y, v), V(1, 0, 0));
  const yh = a => 0.797 + 0.028 * a;
  patch('gloss', (a, b) => fr(0.36 + 0.50 * a, yh(a) + 0.050 * b), 12, 2, 0.003, true); // boîtier d'optique qui contourne l'angle
  ribbon('led', Array.from({ length: 13 }, (_, i) => { const a = 0.04 + 0.92 * i / 12; return fr(0.36 + 0.50 * a, yh(a) + 0.013); }), 0.008, 0.005, true);
  for (const a of [0.30, 0.52]) patch('steel', (x, y) => fr(0.36 + 0.50 * (a + 0.12 * x), yh(a) + 0.026 + 0.016 * y), 2, 1, 0.0045, true); // modules de projecteurs
  for (let k = 0; k < 3; k++) ribbon('led', Array.from({ length: 7 }, (_, i) => { const t = i / 6; return fr(lerp(0.505 + 0.06 * k, 0.535 + 0.06 * k, t), lerp(0.774, 0.62 + 0.012 * k, t)); }), 0.013, 0.005, true); // trois griffes
  patch('gloss', (a, b) => fr(-0.47 + 0.94 * a, 0.50 + 0.252 * b), 16, 4, 0.002); // fond de calandre
  // pavés couleur caisse en dégradé (plus gros vers les optiques), quinconce ; réserve autour du lion
  for (let r = 0; r < 9; r++) for (let c = 0; c < 31; c++) {
    const y = 0.522 + 0.026 * r, v = -0.45 + 0.03 * c + (r % 2 ? 0.015 : 0); if (Math.abs(v) > 0.455) continue;
    if (Math.abs(v) < 0.075 && Math.abs(y - 0.635) < 0.075) continue;
    const s = 0.45 + 0.55 * Math.abs(v) / 0.45; // face avant plane (u = U0) sous y 0,75 : pas besoin de lancer de rayon
    put('paint', new THREE.BoxGeometry(0.004, 0.021 * s, 0.027 * s).translate(U0 - 0.004, y, v));
  }
  put('steel', lion(0.004).rotateY(-Math.PI / 2).translate(U0 - 0.002, 0.635, 0));
  patch('matte', (a, b) => fr(-0.50 + a, 0.415 + 0.075 * b), 10, 1, 0.002); // prise d'air basse
}
// ---------------------------------------------------------------- face arrière : bandeau noir, barre lumineuse fine, griffes rouges
function arriere(PR) {
  const rr = (v, y) => shoot(PR, V(6, y, v), V(-1, 0, 0));
  patch('gloss', (a, b) => rr(-0.70 + 1.40 * a, 0.985 + 0.09 * b), 20, 2, 0.003);
  ribbon('red', Array.from({ length: 29 }, (_, i) => rr(-0.70 + 1.40 * i / 28, 1.012)), 0.007, 0.005);
  patch('gloss', (a, b) => rr(0.66 + 0.21 * a, 0.955 + 0.16 * b), 8, 3, 0.003, true); // blocs optiques d'angle
  for (let k = 0; k < 3; k++) ribbon('red', Array.from({ length: 6 }, (_, i) => { const t = i / 5; return rr(lerp(0.69 + 0.055 * k, 0.72 + 0.055 * k, t), lerp(0.968, 1.10, t)); }), 0.014, 0.005, true);
  patch('matte', (a, b) => rr(-0.72 + 1.44 * a, 0.47 + 0.06 * b), 12, 1, 0.003); // diffuseur
  ribbon('gloss', Array.from({ length: 21 }, (_, i) => rr(-0.80 + 1.60 * i / 20, 0.80)), 0.004, 0.0015); // bas du hayon
  { const h = rr(0, 1.135); if (h) put('steel', lion(0.004).scale(0.8, 0.8, 1).rotateY(Math.PI / 2).translate(h.p.x - 0.001, 1.135, 0)); }
}
// ---------------------------------------------------------------- flancs : traits de portes, poignées affleurantes, contour du capot
function flancs() {
  for (const u of [1.40, 2.38, 3.38]) ribbon('gloss', Array.from({ length: 10 }, (_, i) => onSide(u, lerp(cladTop(u) + 0.004, F.yw(u) - 0.006, i / 9))), 0.0045, 0.0015, true);
  for (const [u0, u1] of [[1.98, 2.15], [2.98, 3.14]]) { const y = F.yw((u0 + u1) / 2) - 0.065; ribbon('gloss', Array.from({ length: 5 }, (_, i) => onSide(lerp(u0, u1, i / 4), y)), 0.022, 0.003, true); }
  ribbon('gloss', Array.from({ length: 16 }, (_, i) => { const u = lerp(0.14, 1.17, i / 15); return onTop(u, section(u).wsh - 0.062); }), 0.0045, 0.0015, true);
  { const w = section(0.14).wsh - 0.062; ribbon('gloss', Array.from({ length: 21 }, (_, i) => onTop(0.14, lerp(-w, w, i / 20))), 0.0045, 0.0015); }
  // custode : bord arrière de la vitre incliné vers l'avant (montant arrière couleur caisse posé sur la vitre), filet noir le long du bord
  const ue = q => 4.125 - 0.27 * q, gy = (u, q) => { const P = section(u).P; return lerp(P[25][1], P[31][1], q); };
  patch('paint', (a, b) => { const u = lerp(ue(b), 4.128, a); return onSide(u, gy(u, b)); }, 4, 6, 0.0015, true);
  ribbon('gloss', Array.from({ length: 7 }, (_, i) => { const q = i / 6, u = ue(q) - 0.006; return onSide(u, gy(u, q)); }), 0.012, 0.0022, true);
}
// ---------------------------------------------------------------- roues : jantes 20" multibranches sombres, pneus 235/50 R20, disques
function roues() {
  const P2 = a => a.map(([r, w]) => new THREE.Vector2(r, w)), lat = (pts, n) => new THREE.LatheGeometry(P2(pts), n).rotateX(Math.PI / 2);
  const W = { tyre: [], alloy: [], steel: [], matte: [] };
  W.tyre.push(lat([[RJ - 0.003, -0.097], [RJ + 0.018, -0.110], [0.300, -0.1175], [0.338, -0.114], [0.358, -0.106], [0.368, -0.092], [RP, -0.07], [RP, 0.07],
    [0.368, 0.092], [0.358, 0.106], [0.338, 0.114], [0.300, 0.1175], [RJ + 0.018, 0.110], [RJ - 0.003, 0.097]], 40));
  W.alloy.push(lat([[0.240, -0.095], [0.236, -0.06], [0.236, 0.03], [0.242, 0.082], [0.252, 0.094], [0.262, 0.099], [0.260, 0.104], [0.249, 0.104]], 40));
  for (let k = 0; k < 10; k++) for (const sg of [-1, 1]) { // 10 doubles branches galbées (voile concave)
    const g = new THREE.BoxGeometry(1, 1, 1, 6, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const s = p.getX(i) + 0.5, ty = p.getY(i), tz = p.getZ(i) + 0.5;
      const r = lerp(0.068, 0.246, s), a = k * Math.PI / 5 + sg * lerp(0.03, 0.075, s), hw = lerp(0.0125, 0.0085, s), wf = lerp(0.060, 0.092, s ** 1.5), c = Math.cos(a), sn = Math.sin(a);
      p.setXYZ(i, r * c - sn * ty * 2 * hw, r * sn + c * ty * 2 * hw, wf - 0.028 * (1 - tz));
    }
    g.computeVertexNormals(); W.alloy.push(g);
  }
  W.alloy.push(new THREE.CylinderGeometry(0.072, 0.078, 0.035, 24).rotateX(Math.PI / 2).translate(0, 0, 0.045));
  W.steel.push(new THREE.CylinderGeometry(0.030, 0.030, 0.006, 20).rotateX(Math.PI / 2).translate(0, 0, 0.064));
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 + 0.3; W.steel.push(new THREE.CylinderGeometry(0.0095, 0.0095, 0.012, 6).rotateX(Math.PI / 2).translate(0.05 * Math.cos(a), 0.05 * Math.sin(a), 0.062)); }
  W.steel.push(new THREE.CylinderGeometry(0.185, 0.185, 0.026, 32).rotateX(Math.PI / 2).translate(0, 0, -0.03));
  W.matte.push(new THREE.BoxGeometry(0.05, 0.12, 0.05).translate(0.165, 0, -0.01).rotateZ(0.6));
  for (const [u, vt] of [[UAV, VAV / 2], [UAR, VAR / 2]]) for (const k of Object.keys(W)) for (const g of W[k]) put(k, g.clone().translate(u, RP, vt), true);
}
// élargisseurs d'ailes noirs (arcs extrudés, affleurant la largeur hors tout 1 895)
function arches() {
  const s = new THREE.Shape(), a0 = -0.16, a1 = Math.PI + 0.16, bt = 0.004, dep = 0.055;
  s.absarc(0, 0, 0.485, a0, a1, false); s.absarc(0, 0, 0.415, a1, a0, true); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: true, bevelThickness: bt, bevelSize: 0.004, bevelSegments: 1, curveSegments: 28 });
  for (const uw of [UAV, UAR]) put('matte', g.clone().translate(uw, RP, W2 - dep - bt), true);
}
// rétroviseurs : coque noire brillante, glace, pied ; bord extérieur à 1,054 de l'axe (2 108 hors tout)
function retro() {
  const se = (rx, ry, rz, e) => { const g = new THREE.SphereGeometry(1, 20, 12), p = g.attributes.position, f = c => Math.sign(c) * Math.abs(c) ** e;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, f(p.getX(i)) * rx, f(p.getY(i)) * ry, f(p.getZ(i)) * rz); g.computeVertexNormals(); return g; };
  const uc = 1.66, yc = 1.135, vc = WM2 - 0.10;
  put('gloss', se(0.052, 0.066, 0.10, 0.55).translate(uc, yc, vc), true);
  put('steel', se(0.004, 0.056, 0.088, 0.4).translate(uc + 0.052, yc, vc), true);
  put('gloss', new THREE.BoxGeometry(0.075, 0.032, 0.11).translate(1.645, 1.07, 0.895), true);
  put('led', se(0.004, 0.006, 0.05, 0.6).translate(uc - 0.04, yc - 0.045, vc + 0.03), true); // répétiteur
}
// barres de toit noires : leur dessus fixe la hauteur hors tout (1 694)
function barres() {
  const vb = 0.62, us = []; for (let u = 2.22; u <= 4.381; u += 0.06) us.push(u);
  const base = us.map(u => surfY(u, vb)), hb = HT - Math.max(...base);
  const prof = [[-1, 0.15], [-0.75, 0], [0.75, 0], [1, 0.15], [1, 0.75], [0.6, 1], [-0.6, 1], [-1, 0.75]];
  const rings = us.map((u, i) => { const foot = Math.min(u - us[0], us[us.length - 1] - u) < 0.07, yb = base[i] + (foot ? -0.004 : 0.012), yt = base[i] + hb;
    return prof.map(([a, b]) => V(u, lerp(yb, yt, b), vb + a * 0.017)); });
  put('gloss', loftRings(rings), true);
  return hb;
}
// becquet de pavillon couleur caisse, en surplomb de la lunette
function becquet() {
  const prof = [[-0.06, 0.0], [0.0, 0.010], [0.08, 0.004], [0.11, -0.010], [0.09, -0.017], [0.0, -0.010]];
  const rings = []; for (let i = 0; i <= 16; i++) { const v = lerp(-0.665, 0.665, i / 16), y0 = surfY(4.44, v); rings.push(prof.map(([du, dy]) => V(4.44 + du, y0 + 0.006 + dy, v))); }
  put('paint', loftRings(rings));
}
function materials() {
  const std = o => new THREE.MeshStandardMaterial(o);
  return {
    // Vert Olivine : vert de gris métallisé, vernis
    paint: new THREE.MeshPhysicalMaterial({ color: '#68735f', metalness: 0.3, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.05 }),
    gloss: std({ color: '#0b0c0d', metalness: 0.2, roughness: 0.18 }),
    matte: std({ color: '#1d1e1f', roughness: 0.85 }),
    glass: std({ color: '#151b1e', metalness: 0.65, roughness: 0.05, envMapIntensity: 1.4 }),
    tyre: std({ color: '#171717', roughness: 0.9 }),
    alloy: std({ color: '#303336', metalness: 0.75, roughness: 0.32, side: THREE.DoubleSide }),
    steel: std({ color: '#c3c6c9', metalness: 1, roughness: 0.2 }),
    led: std({ color: '#f4f8ff', emissive: '#dfe9ff', emissiveIntensity: 0.6, roughness: 0.3 }),
    red: std({ color: '#5c0705', emissive: '#ff1a0d', emissiveIntensity: 0.55, roughness: 0.3 }),
  };
}

// ---------------------------------------------------------------- assemblage
export function buildVoiture(ctx) {
  BK = { paint: [], glass: [], gloss: [], matte: [], tyre: [], alloy: [], steel: [], led: [], red: [] };
  const { PF, PR } = body();
  avant(PF); arriere(PR); flancs(); roues(); arches(); retro(); const hb = barres(); becquet();
  PF.geometry.dispose(); PR.geometry.dispose();
  const MAT = materials(), grp = ctx.groups.furn0, meshes = [];
  for (const k of Object.keys(BK)) {
    if (!BK[k].length) continue;
    const g = mergeGeometries(BK[k], false); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, MAT[k]); m.name = 'voiture ' + k; m.position.set(X0, Y0, ZC);
    m.castShadow = k === 'paint'; m.receiveShadow = true; m.userData.navSkip = true; // collisions : prisme simplifié ci-dessous
    grp.add(m); meshes.push(m);
  }
  // prisme invisible (emprise arrondie aux angles, de 0,15 à 1,55 m) pour les collisions de la visite
  const sh = new THREE.Shape([[0, -0.55], [0.25, -W2], [4.6, -W2], [L, -0.75], [L, 0.75], [4.6, W2], [0.25, W2], [0, 0.55]].map(([x, y]) => new THREE.Vector2(x, y)));
  const cg = new THREE.ExtrudeGeometry(sh, { depth: 1.40, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 0.15, 0);
  const col = new THREE.Mesh(cg, MAT.matte); col.name = 'voiture collision'; col.visible = false; col.position.set(X0, Y0, ZC); grp.add(col);
  return { meshes, hb };
}
